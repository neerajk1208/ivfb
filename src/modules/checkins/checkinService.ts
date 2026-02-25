import { prisma } from "@/lib/db";
import type { CheckInCreate } from "@/lib/validate";
import { updateDailyMoodInsight } from "@/modules/insights/trendsService";
import { toZonedTime } from "date-fns-tz";
import { startOfDay, differenceInDays, subHours } from "date-fns";

export async function createCheckIn(
  userId: string,
  data: CheckInCreate
): Promise<{ id: string }> {
  const checkIn = await prisma.checkIn.create({
    data: {
      userId,
      cycleId: data.cycleId,
      mood: data.mood ?? null,
      symptoms: data.symptoms || [],
      note: data.note ?? null,
      source: data.source || "APP",
    },
  });

  // Update daily mood insight in background
  const cycle = await prisma.cycle.findUnique({
    where: { id: data.cycleId },
    include: { 
      protocol: true,
      user: { select: { timezone: true } },
    },
  });

  if (cycle?.protocol) {
    const userTimezone = cycle.user.timezone || "America/Los_Angeles";
    
    // Calculate cycle day index in user's timezone
    const todayInTz = toZonedTime(new Date(), userTimezone);
    const cycleStartInTz = toZonedTime(cycle.protocol.cycleStartDate, userTimezone);
    
    const todayStart = startOfDay(todayInTz);
    const cycleStartDay = startOfDay(cycleStartInTz);
    
    const cycleDayIndex = differenceInDays(todayStart, cycleStartDay);

    updateDailyMoodInsight(userId, data.cycleId, todayStart, cycleDayIndex).catch((err) => {
      console.error("Failed to update daily mood insight:", err);
    });
  }

  return { id: checkIn.id };
}

export async function getRecentCheckIns(
  userId: string,
  cycleId: string,
  limit = 10
) {
  return prisma.checkIn.findMany({
    where: { userId, cycleId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getTodayCheckIn(userId: string, cycleId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.checkIn.findFirst({
    where: {
      userId,
      cycleId,
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create a passive check-in from inferred mood in chat.
 * Only creates if no recent check-in exists (within last 2 hours) to avoid spam.
 */
export async function createPassiveCheckIn(
  userId: string,
  cycleId: string,
  inferredMood: number,
  timezone: string
): Promise<void> {
  // Check for recent check-in to avoid creating too many
  const recentCutoff = subHours(new Date(), 2);
  const recentCheckIn = await prisma.checkIn.findFirst({
    where: {
      userId,
      cycleId,
      createdAt: { gte: recentCutoff },
    },
  });

  // If there's a recent check-in, don't create another
  if (recentCheckIn) {
    return;
  }

  // Create the passive check-in
  await prisma.checkIn.create({
    data: {
      userId,
      cycleId,
      mood: inferredMood,
      symptoms: [],
      note: null,
      source: "CHAT_INFERRED",
    },
  });

  // Update daily mood insight
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: { protocol: true },
  });

  if (cycle?.protocol) {
    const todayInTz = toZonedTime(new Date(), timezone);
    const cycleStartInTz = toZonedTime(cycle.protocol.cycleStartDate, timezone);
    
    const todayStart = startOfDay(todayInTz);
    const cycleStartDay = startOfDay(cycleStartInTz);
    
    const cycleDayIndex = differenceInDays(todayStart, cycleStartDay);

    updateDailyMoodInsight(userId, cycleId, todayStart, cycleDayIndex).catch((err) => {
      console.error("Failed to update daily mood insight from passive check-in:", err);
    });
  }
}
