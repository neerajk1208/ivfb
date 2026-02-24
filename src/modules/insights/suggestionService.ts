import { prisma } from "@/lib/db";
import { getSuggestionsForContext, type Suggestion } from "@/config/buddy/suggestions";

export async function getRecentSuggestionIds(
  userId: string,
  cycleId: string,
  daysBack: number = 7
): Promise<string[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const recent = await prisma.insight_UserSuggestion.findMany({
    where: {
      userId,
      cycleId,
      shownAt: { gte: cutoff },
    },
    select: { suggestionId: true },
  });

  return recent.map((s) => s.suggestionId);
}

export async function recordSuggestionShown(
  userId: string,
  cycleId: string,
  suggestionId: string
): Promise<void> {
  // Check if already recorded recently to prevent duplicates
  const recentCutoff = new Date();
  recentCutoff.setMinutes(recentCutoff.getMinutes() - 5);

  const existing = await prisma.insight_UserSuggestion.findFirst({
    where: {
      userId,
      cycleId,
      suggestionId,
      shownAt: { gte: recentCutoff },
    },
  });

  if (!existing) {
    await prisma.insight_UserSuggestion.create({
      data: {
        userId,
        cycleId,
        suggestionId,
      },
    });
  }
}

export async function recordSuggestionFeedback(
  userId: string,
  cycleId: string,
  suggestionId: string,
  wasHelpful: boolean
): Promise<void> {
  const existing = await prisma.insight_UserSuggestion.findFirst({
    where: {
      userId,
      cycleId,
      suggestionId,
      wasHelpful: null,
    },
    orderBy: { shownAt: "desc" },
  });

  if (existing) {
    await prisma.insight_UserSuggestion.update({
      where: { id: existing.id },
      data: {
        wasHelpful,
        respondedAt: new Date(),
      },
    });
  }
}

export async function getHelpfulSuggestionIds(userId: string): Promise<string[]> {
  const helpful = await prisma.insight_UserSuggestion.findMany({
    where: {
      userId,
      wasHelpful: true,
    },
    distinct: ["suggestionId"],
    select: { suggestionId: true },
  });

  return helpful.map((s) => s.suggestionId);
}

export async function pickSuggestionsForUser(
  userId: string,
  cycleId: string,
  phase: string,
  symptoms: string[],
  mood: number | null
): Promise<Suggestion[]> {
  const recentIds = await getRecentSuggestionIds(userId, cycleId);
  return getSuggestionsForContext(phase, symptoms, mood, recentIds, 2);
}
