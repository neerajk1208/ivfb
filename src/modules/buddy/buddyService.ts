import { prisma } from "@/lib/db";
import { getOpenAIClient, getModel } from "./openaiClient";
import { buddyReplySchema, buddyReplyJsonSchema, type BuddyReply } from "./buddySchemas";
import { getFallbackReply } from "./fallbackRules";
import { containsSevereKeyword, escalationResponse } from "@/config/buddy/severeKeywords";
import { buddySystemPrompt, buddyContextTemplate } from "@/config/buddy/system";
import { appConfig } from "@/config/app";
import { getResourcesForContext, type Resource } from "@/config/buddy/resources";
import { pickSuggestionsForUser, recordSuggestionShown } from "@/modules/insights/suggestionService";
import { getMemoriesForUser, formatMemoriesForContext, processMessageForMemories } from "@/modules/insights/memoryService";
import { getRecentMoodTrend, formatTrendForContext } from "@/modules/insights/trendsService";
import { getCycleDayIndex } from "@/lib/time";
import { toZonedTime } from "date-fns-tz";

interface BuddyContext {
  userId: string;
  cycleId: string;
  userMessage: string;
  mood: number | null;
  symptoms: string[];
  userTimezone: string;
}

export async function generateBuddyReply(context: BuddyContext): Promise<BuddyReply> {
  if (containsSevereKeyword(context.userMessage)) {
    return {
      messageText: escalationResponse,
      tags: ["escalation", "urgent"],
      escalation: true,
    };
  }

  try {
    const enrichedContext = await buildEnrichedContext(context);
    const reply = await callOpenAI(enrichedContext, context.userMessage);
    
    await updateConversationState(context.userId, context.cycleId, context.userMessage, reply.messageText);
    
    return reply;
  } catch (error) {
    console.error("Buddy reply generation failed:", error);
    return getFallbackReply(context.mood);
  }
}

async function buildEnrichedContext(context: BuddyContext): Promise<string> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: context.cycleId },
    include: {
      protocol: { 
        include: { 
          medications: true,
          appointments: true,
        } 
      },
      tasks: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" },
        take: 3,
      },
      convoState: true,
    },
  });

  const recentCheckIns = await prisma.checkIn.findMany({
    where: { cycleId: context.cycleId },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const today = toZonedTime(new Date(), context.userTimezone);
  const cycleStartDate = cycle?.protocol?.cycleStartDate
    ? toZonedTime(cycle.protocol.cycleStartDate, context.userTimezone)
    : today;

  const cycleDayIndex = getCycleDayIndex(cycleStartDate, today);

  // Get today's medications with details
  const todayMedsList = cycle?.protocol?.medications.filter((m) => {
    const start = m.startDayOffset;
    const end = m.startDayOffset + m.durationDays - 1;
    return cycleDayIndex >= start && cycleDayIndex <= end;
  }) || [];

  const todayMeds = todayMedsList
    .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`)
    .join(", ") || "None scheduled";

  // Count injections (subcutaneous or intramuscular)
  const injectionCount = todayMedsList.filter(
    (m) => m.route === "subcutaneous" || m.route === "intramuscular"
  ).length;

  // Determine cycle phase and next big event
  const appointments = cycle?.protocol?.appointments || [];
  const bigEventTypes = ["TRIGGER", "RETRIEVAL", "TRANSFER"];
  
  const upcomingBigEvents = appointments
    .filter((a) => bigEventTypes.includes(a.type) && a.dayOffset >= cycleDayIndex)
    .sort((a, b) => a.dayOffset - b.dayOffset);

  const nextBigEvent = upcomingBigEvents[0];
  const daysUntilBigEvent = nextBigEvent 
    ? `${nextBigEvent.type} in ${nextBigEvent.dayOffset - cycleDayIndex} days`
    : "No major events scheduled";

  // Determine phase based on appointments and cycle day
  const cyclePhase = determineCyclePhase(cycleDayIndex, appointments);

  const nextTasks = cycle?.tasks
    .slice(0, 2)
    .map((t) => t.label)
    .join(", ") || "None upcoming";

  const recentMoods = recentCheckIns
    .filter((c) => c.mood !== null)
    .map((c) => c.mood)
    .join(", ") || "No recent mood data";

  const recentSymptoms = [...new Set(recentCheckIns.flatMap((c) => c.symptoms))]
    .slice(0, 5)
    .join(", ") || "None reported";

  const conversationSummary = cycle?.convoState?.summary || "No previous conversation";

  // Get relevant resources based on phase and symptoms
  const relevantResources = getResourcesForContext(cyclePhase, context.symptoms);
  const resourcesText = relevantResources.length > 0
    ? relevantResources.map((r) => `- ${r.title}: ${r.url}`).join("\n")
    : "No specific resources for this context";

  // Get personalized suggestions
  const suggestions = await pickSuggestionsForUser(
    context.userId,
    context.cycleId,
    cyclePhase,
    context.symptoms,
    context.mood
  );
  const suggestionsText = suggestions.length > 0
    ? suggestions.map((s) => `- [${s.id}] ${s.text}`).join("\n")
    : "No specific suggestions for this context";

  // Record that these suggestions were shown
  for (const s of suggestions) {
    await recordSuggestionShown(context.userId, context.cycleId, s.id);
  }

  // Get user memories for personalization
  const memories = await getMemoriesForUser(context.userId, 10);
  const memoriesText = formatMemoriesForContext(memories);

  // Process message for new memories (async, don't block)
  processMessageForMemories(context.userId, context.userMessage).catch(() => {});

  // Get mood trends
  const moodTrend = await getRecentMoodTrend(context.userId, context.cycleId);
  const moodTrendText = formatTrendForContext(moodTrend);

  return buddyContextTemplate
    .replace("{{cycleDayIndex}}", cycleDayIndex.toString())
    .replace("{{cyclePhase}}", cyclePhase)
    .replace("{{injectionCount}}", injectionCount.toString())
    .replace("{{daysUntilBigEvent}}", daysUntilBigEvent)
    .replace("{{todayMeds}}", todayMeds)
    .replace("{{nextTasks}}", nextTasks)
    .replace("{{recentMood}}", recentMoods)
    .replace("{{recentSymptoms}}", recentSymptoms)
    .replace("{{relevantResources}}", resourcesText)
    .replace("{{suggestions}}", suggestionsText)
    .replace("{{memories}}", memoriesText)
    .replace("{{moodTrend}}", moodTrendText)
    .replace("{{userMessage}}", context.userMessage)
    .replace("{{conversationSummary}}", conversationSummary);
}

function determineCyclePhase(
  cycleDayIndex: number, 
  appointments: Array<{ type: string; dayOffset: number }>
): string {
  const trigger = appointments.find((a) => a.type === "TRIGGER");
  const retrieval = appointments.find((a) => a.type === "RETRIEVAL");
  const transfer = appointments.find((a) => a.type === "TRANSFER");

  if (transfer && cycleDayIndex >= transfer.dayOffset) {
    const daysPost = cycleDayIndex - transfer.dayOffset;
    if (daysPost === 0) return "transfer_day";
    return `tww_day_${daysPost}`;
  }
  
  if (retrieval && cycleDayIndex >= retrieval.dayOffset) {
    const daysPost = cycleDayIndex - retrieval.dayOffset;
    if (daysPost === 0) return "retrieval_day";
    return `post_retrieval_day_${daysPost}`;
  }
  
  if (trigger && cycleDayIndex >= trigger.dayOffset) {
    return "trigger_day";
  }
  
  if (trigger && cycleDayIndex === trigger.dayOffset - 1) {
    return "pre_trigger";
  }

  return `stimulation_day_${cycleDayIndex}`;
}

async function callOpenAI(contextPrompt: string, userMessage: string): Promise<BuddyReply> {
  const client = getOpenAIClient();
  const model = getModel();

  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: buddySystemPrompt },
      { role: "user", content: contextPrompt },
    ],
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in buddy response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = buddyReplySchema.safeParse(parsed);

  if (!validated.success) {
    console.warn("Buddy reply validation failed:", validated.error);
    throw new Error("Invalid buddy reply format");
  }

  return validated.data;
}

async function updateConversationState(
  userId: string,
  cycleId: string,
  userMessage: string,
  buddyReply: string
): Promise<void> {
  const existing = await prisma.conversationState.findUnique({
    where: { cycleId },
  });

  const newEntry = `User: ${userMessage.slice(0, 100)}... | Buddy: ${buddyReply.slice(0, 100)}...`;
  
  let summary = existing?.summary || "";
  summary = `${summary}\n${newEntry}`.trim();

  if (summary.length > appConfig.conversationSummaryMaxLength) {
    const lines = summary.split("\n");
    while (summary.length > appConfig.conversationSummaryMaxLength && lines.length > 1) {
      lines.shift();
      summary = lines.join("\n");
    }
  }

  await prisma.conversationState.upsert({
    where: { cycleId },
    update: { summary },
    create: {
      userId,
      cycleId,
      summary,
    },
  });
}
