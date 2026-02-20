import { prisma } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { generateBuddyReply } from "@/modules/buddy/buddyService";

const MAX_DAILY_MESSAGES = 30;

export type MessageSender = "SYSTEM" | "USER" | "BUDDY";
export type MessageType = "REMINDER" | "CHECKIN" | "APPOINTMENT" | "INFO" | "MESSAGE";

export interface CreateChatMessageInput {
  userId: string;
  cycleId: string;
  sender: MessageSender;
  type: MessageType;
  content: string;
  meta?: any;
}

export async function createChatMessage(input: CreateChatMessageInput) {
  return prisma.chatMessage.create({
    data: {
      userId: input.userId,
      cycleId: input.cycleId,
      sender: input.sender,
      type: input.type,
      content: input.content,
      meta: input.meta || null,
    },
  });
}

export async function getMessagesForDate(
  userId: string,
  cycleId: string,
  date: Date,
  timezone: string
) {
  const localDate = toZonedTime(date, timezone);
  const dayStart = fromZonedTime(startOfDay(localDate), timezone);
  const dayEnd = fromZonedTime(endOfDay(localDate), timezone);

  return prisma.chatMessage.findMany({
    where: {
      userId,
      cycleId,
      createdAt: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDailyContext(
  cycleId: string,
  date: Date,
  timezone: string
) {
  const protocol = await prisma.protocolPlan.findFirst({
    where: { cycleId, status: "ACTIVE" },
    include: {
      medications: true,
      appointments: true,
      cycle: true,
    },
  });

  if (!protocol) {
    return null;
  }

  const localDate = toZonedTime(date, timezone);
  localDate.setHours(0, 0, 0, 0);

  const cycleStart = toZonedTime(protocol.cycleStartDate, timezone);
  cycleStart.setHours(0, 0, 0, 0);

  const diffTime = localDate.getTime() - cycleStart.getTime();
  const cycleDayIndex = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const todaysMeds = protocol.medications.filter((med) => {
    const medStart = med.startDayOffset;
    const medEnd = med.startDayOffset + med.durationDays - 1;
    return cycleDayIndex >= medStart && cycleDayIndex <= medEnd;
  });

  const todaysAppointments = protocol.appointments.filter(
    (apt) => apt.dayOffset === cycleDayIndex
  );

  return {
    cycleDayIndex,
    cycleStartDate: protocol.cycleStartDate,
    medications: todaysMeds.map((med) => ({
      id: med.id,
      name: med.name,
      dosageAmount: med.dosageAmount,
      dosageUnit: med.dosageUnit,
      dosage: med.dosage,
      timeOfDay: med.timeOfDay,
      exactTime: med.exactTime,
    })),
    appointments: todaysAppointments.map((apt) => ({
      id: apt.id,
      type: apt.type,
      exactTime: apt.exactTime,
      fasting: apt.fasting,
      critical: apt.critical,
      notes: apt.notes,
    })),
  };
}

export async function checkDailyLimit(userId: string, timezone: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyMsgCount: true, lastMsgDate: true },
  });

  if (!user) {
    return { allowed: false, remaining: 0 };
  }

  const today = toZonedTime(new Date(), timezone);
  today.setHours(0, 0, 0, 0);

  const lastMsgDate = user.lastMsgDate
    ? toZonedTime(user.lastMsgDate, timezone)
    : null;

  if (lastMsgDate) {
    lastMsgDate.setHours(0, 0, 0, 0);
  }

  const isNewDay = !lastMsgDate || lastMsgDate.getTime() < today.getTime();
  const currentCount = isNewDay ? 0 : user.dailyMsgCount;
  const remaining = MAX_DAILY_MESSAGES - currentCount;

  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
  };
}

export async function incrementMessageCount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dailyMsgCount: true, lastMsgDate: true, timezone: true },
  });

  if (!user) return;

  const today = toZonedTime(new Date(), user.timezone);
  today.setHours(0, 0, 0, 0);

  const lastMsgDate = user.lastMsgDate
    ? toZonedTime(user.lastMsgDate, user.timezone)
    : null;

  if (lastMsgDate) {
    lastMsgDate.setHours(0, 0, 0, 0);
  }

  const isNewDay = !lastMsgDate || lastMsgDate.getTime() < today.getTime();

  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyMsgCount: isNewDay ? 1 : { increment: 1 },
      lastMsgDate: new Date(),
    },
  });
}

export async function sendUserMessage(
  userId: string,
  cycleId: string,
  content: string,
  timezone: string
): Promise<{ userMessage: any; buddyReply: any; limitReached: boolean }> {
  const limitCheck = await checkDailyLimit(userId, timezone);
  
  if (!limitCheck.allowed) {
    const limitMsg = await createChatMessage({
      userId,
      cycleId,
      sender: "SYSTEM",
      type: "INFO",
      content: `You've reached your daily message limit (${MAX_DAILY_MESSAGES}). Check back tomorrow! 💛`,
    });
    return { userMessage: null, buddyReply: limitMsg, limitReached: true };
  }

  const userMessage = await createChatMessage({
    userId,
    cycleId,
    sender: "USER",
    type: "MESSAGE",
    content,
  });

  await incrementMessageCount(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  const buddyResponse = await generateBuddyReply({
    userId,
    cycleId,
    userMessage: content,
    mood: null,
    symptoms: [],
    userTimezone: user?.timezone || "America/Los_Angeles",
  });

  const buddyMessage = await createChatMessage({
    userId,
    cycleId,
    sender: "BUDDY",
    type: "MESSAGE",
    content: buddyResponse.messageText,
    meta: {
      tags: buddyResponse.tags,
      escalate: buddyResponse.escalation,
    },
  });

  return { userMessage, buddyReply: buddyMessage, limitReached: false };
}

export async function markMessagesAsRead(userId: string, cycleId: string, date: Date, timezone: string) {
  const localDate = toZonedTime(date, timezone);
  const dayStart = fromZonedTime(startOfDay(localDate), timezone);
  const dayEnd = fromZonedTime(endOfDay(localDate), timezone);

  await prisma.chatMessage.updateMany({
    where: {
      userId,
      cycleId,
      createdAt: { gte: dayStart, lte: dayEnd },
      read: false,
    },
    data: { read: true },
  });
}

export async function getUnreadCount(userId: string, cycleId: string): Promise<number> {
  return prisma.chatMessage.count({
    where: {
      userId,
      cycleId,
      read: false,
      sender: { not: "USER" },
    },
  });
}
