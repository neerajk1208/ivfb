import { prisma } from "@/lib/db";
import { getOpenAIClient, getModel } from "./openaiClient";
import { buddyReplySchema, buddyReplyJsonSchema, type BuddyReply } from "./buddySchemas";
import { getFallbackReply } from "./fallbackRules";
import { containsSevereKeyword, escalationResponse } from "@/config/buddy/severeKeywords";
import { buddySystemPrompt, buddyContextTemplate } from "@/config/buddy/system";
import { appConfig } from "@/config/app";
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
      protocol: { include: { medications: true } },
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

  const todayMeds = cycle?.protocol?.medications
    .filter((m) => {
      const start = m.startDayOffset;
      const end = m.startDayOffset + m.durationDays - 1;
      return cycleDayIndex >= start && cycleDayIndex <= end;
    })
    .map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`)
    .join(", ") || "None scheduled";

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

  return buddyContextTemplate
    .replace("{{cycleDayIndex}}", cycleDayIndex.toString())
    .replace("{{todayMeds}}", todayMeds)
    .replace("{{nextTasks}}", nextTasks)
    .replace("{{recentMood}}", recentMoods)
    .replace("{{recentSymptoms}}", recentSymptoms)
    .replace("{{userMessage}}", context.userMessage)
    .replace("{{conversationSummary}}", conversationSummary);
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
