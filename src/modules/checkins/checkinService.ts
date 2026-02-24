import { prisma } from "@/lib/db";
import type { CheckInCreate } from "@/lib/validate";
import { updateDailyMoodInsight } from "@/modules/insights/trendsService";
import { toZonedTime } from "date-fns-tz";
import { startOfDay, differenceInDays } from "date-fns";

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
