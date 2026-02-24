import { prisma } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

export interface MoodTrend {
  direction: "improving" | "declining" | "stable" | "insufficient_data";
  avgMood: number | null;
  recentMoods: number[];
  symptomPattern: string[];
}

export interface TrendInsight {
  summary: string;
  positivePatterns: string[];
  concerns: string[];
}

export async function getRecentMoodTrend(
  userId: string,
  cycleId: string,
  daysBack: number = 3
): Promise<MoodTrend> {
  const cutoff = subDays(new Date(), daysBack);

  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId,
      cycleId,
      createdAt: { gte: cutoff },
      mood: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: daysBack,
    select: { mood: true, symptoms: true },
  });

  if (checkIns.length < 2) {
    return {
      direction: "insufficient_data",
      avgMood: checkIns[0]?.mood ?? null,
      recentMoods: checkIns.map((c) => c.mood!),
      symptomPattern: [],
    };
  }

  const moods = checkIns.map((c) => c.mood!);
  const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;

  const allSymptoms = checkIns.flatMap((c) => c.symptoms);
  const symptomCounts = allSymptoms.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const symptomPattern = Object.entries(symptomCounts)
    .filter(([_, count]) => count >= 2)
    .map(([symptom]) => symptom);

  const [latest, ...older] = moods;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  let direction: MoodTrend["direction"];
  if (latest - olderAvg >= 0.5) {
    direction = "improving";
  } else if (olderAvg - latest >= 0.5) {
    direction = "declining";
  } else {
    direction = "stable";
  }

  return { direction, avgMood, recentMoods: moods, symptomPattern };
}

export async function updateDailyMoodInsight(
  userId: string,
  cycleId: string,
  date: Date,
  cycleDayIndex: number
): Promise<void> {
  const dayStart = startOfDay(date);

  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId,
      cycleId,
      createdAt: {
        gte: dayStart,
        lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    select: { mood: true, symptoms: true, note: true },
  });

  if (checkIns.length === 0) return;

  const moods = checkIns.filter((c) => c.mood !== null).map((c) => c.mood!);
  const avgMood = moods.length > 0
    ? moods.reduce((a, b) => a + b, 0) / moods.length
    : null;

  const allSymptoms = [...new Set(checkIns.flatMap((c) => c.symptoms))];
  const notes = checkIns.filter((c) => c.note).map((c) => c.note!).join("; ");

  await prisma.insight_DailyMood.upsert({
    where: {
      userId_cycleId_date: { userId, cycleId, date: dayStart },
    },
    create: {
      userId,
      cycleId,
      date: dayStart,
      cycleDayIndex,
      avgMood,
      symptoms: allSymptoms,
      notes: notes || null,
    },
    update: {
      avgMood,
      symptoms: allSymptoms,
      notes: notes || null,
    },
  });
}

export async function getCycleMoodSummary(
  userId: string,
  cycleId: string
): Promise<{ avgMood: number | null; trendByPhase: Record<string, number> }> {
  const dailyMoods = await prisma.insight_DailyMood.findMany({
    where: { userId, cycleId, avgMood: { not: null } },
    select: { avgMood: true, cycleDayIndex: true },
  });

  if (dailyMoods.length === 0) {
    return { avgMood: null, trendByPhase: {} };
  }

  const totalAvg =
    dailyMoods.reduce((a, b) => a + (b.avgMood || 0), 0) / dailyMoods.length;

  const byPhase: Record<string, number[]> = {
    early_stim: [],
    mid_stim: [],
    late_stim: [],
    post_retrieval: [],
    tww: [],
  };

  for (const d of dailyMoods) {
    if (d.avgMood === null) continue;
    if (d.cycleDayIndex <= 3) byPhase.early_stim.push(d.avgMood);
    else if (d.cycleDayIndex <= 7) byPhase.mid_stim.push(d.avgMood);
    else if (d.cycleDayIndex <= 12) byPhase.late_stim.push(d.avgMood);
    else if (d.cycleDayIndex <= 15) byPhase.post_retrieval.push(d.avgMood);
    else byPhase.tww.push(d.avgMood);
  }

  const trendByPhase: Record<string, number> = {};
  for (const [phase, moods] of Object.entries(byPhase)) {
    if (moods.length > 0) {
      trendByPhase[phase] = moods.reduce((a, b) => a + b, 0) / moods.length;
    }
  }

  return { avgMood: totalAvg, trendByPhase };
}

export function formatTrendForContext(trend: MoodTrend): string {
  const parts: string[] = [];

  if (trend.direction === "insufficient_data") {
    parts.push("Not enough check-ins yet to detect mood trends");
  } else {
    const directionText = {
      improving: "Mood is trending up",
      declining: "Mood seems to be dipping",
      stable: "Mood has been steady",
    }[trend.direction];

    parts.push(`${directionText} (avg: ${trend.avgMood?.toFixed(1) || "N/A"}/5)`);

    if (trend.recentMoods.length > 0) {
      parts.push(`Recent scores: ${trend.recentMoods.join(" → ")}`);
    }
  }

  if (trend.symptomPattern.length > 0) {
    parts.push(`Recurring symptoms: ${trend.symptomPattern.join(", ")}`);
  }

  return parts.join(". ");
}

export async function generateTrendInsight(
  userId: string,
  cycleId: string
): Promise<TrendInsight> {
  const trend = await getRecentMoodTrend(userId, cycleId);
  const summary = await getCycleMoodSummary(userId, cycleId);

  const insights: TrendInsight = {
    summary: "",
    positivePatterns: [],
    concerns: [],
  };

  if (trend.direction === "improving") {
    insights.positivePatterns.push("Mood has been improving recently");
  } else if (trend.direction === "declining" && trend.avgMood !== null && trend.avgMood < 2.5) {
    insights.concerns.push("Mood has been declining - might need extra support");
  }

  if (trend.symptomPattern.includes("anxious") || trend.symptomPattern.includes("worried")) {
    insights.concerns.push("Anxiety has been a recurring theme");
  }

  if (trend.symptomPattern.includes("tired") || trend.symptomPattern.includes("exhausted")) {
    insights.concerns.push("Fatigue has been persistent");
  }

  const hardestPhase = Object.entries(summary.trendByPhase)
    .filter(([_, avg]) => avg < 2.5)
    .map(([phase]) => phase);

  if (hardestPhase.length > 0) {
    insights.summary = `${hardestPhase.join(", ")} phase(s) have been particularly challenging`;
  } else if (summary.avgMood !== null) {
    insights.summary = `Overall cycle mood: ${summary.avgMood.toFixed(1)}/5`;
  } else {
    insights.summary = "Building mood data as check-ins come in";
  }

  return insights;
}
