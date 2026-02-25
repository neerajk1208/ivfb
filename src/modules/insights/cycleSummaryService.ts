/**
 * Cycle Summary Generator
 * 
 * Generates end-of-cycle summaries with:
 * - Total appointments
 * - Planned injections
 * - Mood trend data (for chart)
 * - What helped most
 * - Hardest days
 * - Common symptoms
 */

import { prisma } from "@/lib/db";

export interface CycleSummary {
  cycleId: string;
  totalDays: number;
  
  // Appointments
  totalAppointments: number;
  appointmentsByType: Record<string, number>;
  
  // Injections (planned from protocol)
  plannedInjections: number;
  injectionMedications: string[];
  
  // Mood data
  avgMood: number | null;
  moodByDay: Array<{
    cycleDayIndex: number;
    avgMood: number | null;
    symptoms: string[];
  }>;
  moodByPhase: Record<string, number>;
  
  // Insights
  hardestDays: Array<{
    cycleDayIndex: number;
    avgMood: number;
    symptoms: string[];
  }>;
  bestDays: Array<{
    cycleDayIndex: number;
    avgMood: number;
  }>;
  
  // What helped
  whatHelped: string[];
  
  // Common symptoms
  commonSymptoms: Array<{
    symptom: string;
    count: number;
  }>;
  
  // Suggestions for next time
  suggestionsForNextTime: string[];
}

/**
 * Generate a comprehensive cycle summary.
 */
export async function generateCycleSummary(
  userId: string,
  cycleId: string
): Promise<CycleSummary | null> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      protocol: {
        include: {
          medications: true,
          appointments: true,
        },
      },
    },
  });

  if (!cycle || !cycle.protocol) {
    return null;
  }

  // Calculate total days
  const totalDays = Math.max(
    ...cycle.protocol.medications.map(m => m.startDayOffset + m.durationDays),
    ...cycle.protocol.appointments.map(a => a.dayOffset),
    0
  );

  // Count appointments by type
  const appointmentsByType: Record<string, number> = {};
  for (const apt of cycle.protocol.appointments) {
    appointmentsByType[apt.type] = (appointmentsByType[apt.type] || 0) + 1;
  }

  // Count planned injections
  const injectionMeds = cycle.protocol.medications.filter(
    m => m.route === "subcutaneous" || m.route === "intramuscular"
  );
  const plannedInjections = injectionMeds.reduce(
    (sum, m) => sum + m.durationDays,
    0
  );
  const injectionMedications = [...new Set(injectionMeds.map(m => m.name))];

  // Get daily mood data
  const dailyMoods = await prisma.insight_DailyMood.findMany({
    where: { userId, cycleId },
    orderBy: { cycleDayIndex: "asc" },
    select: {
      cycleDayIndex: true,
      avgMood: true,
      symptoms: true,
    },
  });

  // Calculate overall average mood
  const moodsWithValues = dailyMoods.filter(d => d.avgMood !== null);
  const avgMood = moodsWithValues.length > 0
    ? moodsWithValues.reduce((sum, d) => sum + (d.avgMood || 0), 0) / moodsWithValues.length
    : null;

  // Calculate mood by phase
  const moodByPhase: Record<string, number[]> = {
    early_stim: [],
    mid_stim: [],
    late_stim: [],
    post_retrieval: [],
    tww: [],
  };

  for (const d of dailyMoods) {
    if (d.avgMood === null) continue;
    if (d.cycleDayIndex <= 3) moodByPhase.early_stim.push(d.avgMood);
    else if (d.cycleDayIndex <= 7) moodByPhase.mid_stim.push(d.avgMood);
    else if (d.cycleDayIndex <= 12) moodByPhase.late_stim.push(d.avgMood);
    else if (d.cycleDayIndex <= 15) moodByPhase.post_retrieval.push(d.avgMood);
    else moodByPhase.tww.push(d.avgMood);
  }

  const moodByPhaseAvg: Record<string, number> = {};
  for (const [phase, moods] of Object.entries(moodByPhase)) {
    if (moods.length > 0) {
      moodByPhaseAvg[phase] = moods.reduce((a, b) => a + b, 0) / moods.length;
    }
  }

  // Find hardest days (lowest mood)
  const hardestDays = moodsWithValues
    .filter(d => d.avgMood !== null && d.avgMood <= 2.5)
    .sort((a, b) => (a.avgMood || 5) - (b.avgMood || 5))
    .slice(0, 3)
    .map(d => ({
      cycleDayIndex: d.cycleDayIndex,
      avgMood: d.avgMood!,
      symptoms: d.symptoms,
    }));

  // Find best days (highest mood)
  const bestDays = moodsWithValues
    .filter(d => d.avgMood !== null && d.avgMood >= 4)
    .sort((a, b) => (b.avgMood || 0) - (a.avgMood || 0))
    .slice(0, 3)
    .map(d => ({
      cycleDayIndex: d.cycleDayIndex,
      avgMood: d.avgMood!,
    }));

  // Get what helped from memories
  const whatHelpedMemories = await prisma.insight_UserMemory.findMany({
    where: { userId, category: "whatHelped" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { content: true },
  });
  const whatHelped = whatHelpedMemories.map(m => m.content);

  // Count common symptoms
  const allSymptoms = dailyMoods.flatMap(d => d.symptoms);
  const symptomCounts: Record<string, number> = {};
  for (const symptom of allSymptoms) {
    symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
  }
  const commonSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symptom, count]) => ({ symptom, count }));

  // Generate suggestions for next time based on patterns
  const suggestionsForNextTime: string[] = [];
  
  // Based on hardest phase
  const hardestPhase = Object.entries(moodByPhaseAvg)
    .filter(([_, avg]) => avg < 3)
    .sort((a, b) => a[1] - b[1])[0];
  
  if (hardestPhase) {
    const phaseLabels: Record<string, string> = {
      early_stim: "early stimulation (days 1-3)",
      mid_stim: "mid stimulation (days 4-7)",
      late_stim: "late stimulation (days 8+)",
      post_retrieval: "post-retrieval",
      tww: "the two-week wait",
    };
    suggestionsForNextTime.push(
      `Plan extra self-care during ${phaseLabels[hardestPhase[0]]} - this was your hardest phase.`
    );
  }

  // Based on recurring symptoms
  if (commonSymptoms.some(s => s.symptom.toLowerCase().includes("tired") || s.symptom.toLowerCase().includes("fatigue"))) {
    suggestionsForNextTime.push("Fatigue was common - consider scheduling lighter days during stims.");
  }
  if (commonSymptoms.some(s => s.symptom.toLowerCase().includes("anxious") || s.symptom.toLowerCase().includes("anxiety"))) {
    suggestionsForNextTime.push("Anxiety was recurring - grounding techniques and check-ins with your support system may help.");
  }
  if (commonSymptoms.some(s => s.symptom.toLowerCase().includes("bloat"))) {
    suggestionsForNextTime.push("Bloating was common - stock up on comfortable clothes and electrolytes.");
  }

  // Based on what helped
  if (whatHelped.length > 0) {
    suggestionsForNextTime.push(`What worked before: ${whatHelped.slice(0, 2).join(", ")}`);
  }

  return {
    cycleId,
    totalDays,
    totalAppointments: cycle.protocol.appointments.length,
    appointmentsByType,
    plannedInjections,
    injectionMedications,
    avgMood,
    moodByDay: dailyMoods,
    moodByPhase: moodByPhaseAvg,
    hardestDays,
    bestDays,
    whatHelped,
    commonSymptoms,
    suggestionsForNextTime,
  };
}

/**
 * Save cycle summary to database.
 */
export async function saveCycleSummary(
  userId: string,
  cycleId: string,
  summary: CycleSummary
): Promise<void> {
  await prisma.insight_CycleSummary.upsert({
    where: { cycleId },
    create: {
      userId,
      cycleId,
      totalDays: summary.totalDays,
      avgMood: summary.avgMood,
      commonSymptoms: summary.commonSymptoms.map(s => s.symptom),
      whatHelped: summary.whatHelped,
      whatDidntHelp: [], // Not tracked yet
      injectionTotal: summary.plannedInjections,
      completedAt: new Date(),
    },
    update: {
      totalDays: summary.totalDays,
      avgMood: summary.avgMood,
      commonSymptoms: summary.commonSymptoms.map(s => s.symptom),
      whatHelped: summary.whatHelped,
      injectionTotal: summary.plannedInjections,
      completedAt: new Date(),
    },
  });
}

/**
 * Get saved cycle summary from database.
 */
export async function getSavedCycleSummary(cycleId: string) {
  return prisma.insight_CycleSummary.findUnique({
    where: { cycleId },
  });
}
