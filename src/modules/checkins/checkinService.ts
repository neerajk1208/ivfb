import { prisma } from "@/lib/db";
import type { CheckInCreate } from "@/lib/validate";
import { updateDailyMoodInsight } from "@/modules/insights/trendsService";

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
    include: { protocol: true },
  });

  if (cycle?.protocol) {
    const today = new Date();
    const cycleStart = cycle.protocol.cycleStartDate;
    const cycleDayIndex = Math.floor(
      (today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    updateDailyMoodInsight(userId, data.cycleId, today, cycleDayIndex).catch((err) => {
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
