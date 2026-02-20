import { prisma } from "@/lib/db";

export async function getDueTasks(limit = 50) {
  return prisma.task.findMany({
    where: {
      status: "PENDING",
      kind: { in: ["REMINDER", "CHECKIN"] },
      dueAt: { lte: new Date() },
      cycle: {
        user: {
          smsConsent: true,
          phoneE164: { not: null },
        },
      },
    },
    include: {
      cycle: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}

export async function markTaskSent(taskId: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      status: "SENT",
      meta: {
        sentAt: new Date().toISOString(),
      },
    },
  });
}

export async function markTaskDone(taskId: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE" },
  });
}

export async function getTodayTasks(cycleId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.task.findMany({
    where: {
      cycleId,
      dueAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    orderBy: { dueAt: "asc" },
  });
}

export async function getUpcomingTasks(cycleId: string, limit = 10) {
  return prisma.task.findMany({
    where: {
      cycleId,
      dueAt: { gt: new Date() },
      status: "PENDING",
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}
