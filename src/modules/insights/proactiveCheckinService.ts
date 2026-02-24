import { prisma } from "@/lib/db";
import { addHours, startOfDay, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const BIG_EVENT_TYPES = ["TRIGGER", "RETRIEVAL", "TRANSFER"];

interface ProactiveCheckInConfig {
  eventType: string;
  delayHours: number;
  message: string;
  displayInUI: boolean;
}

const PROACTIVE_CHECKIN_CONFIG: ProactiveCheckInConfig[] = [
  {
    eventType: "TRIGGER",
    delayHours: 12,
    message: "How are you feeling after your trigger shot last night? This is a big milestone! 💉",
    displayInUI: false,
  },
  {
    eventType: "RETRIEVAL",
    delayHours: 4,
    message: "How are you doing after retrieval? Rest up and be gentle with yourself today. 💛",
    displayInUI: false,
  },
  {
    eventType: "RETRIEVAL",
    delayHours: 24,
    message: "Day after retrieval check-in: How's your body feeling? Any concerns?",
    displayInUI: false,
  },
  {
    eventType: "TRANSFER",
    delayHours: 4,
    message: "You did it! How are you feeling after your transfer? 🤍",
    displayInUI: false,
  },
  {
    eventType: "TRANSFER",
    delayHours: 24,
    message: "Day 1 of the wait. How are you holding up? Remember: you can't mess this up by thinking about it too much.",
    displayInUI: false,
  },
];

export async function scheduleProactiveCheckIns(
  userId: string,
  cycleId: string,
  appointments: Array<{
    type: string;
    date: Date | null;
    dayOffset: number;
  }>,
  cycleStartDate: Date,
  timezone: string
): Promise<number> {
  let scheduled = 0;

  for (const apt of appointments) {
    if (!BIG_EVENT_TYPES.includes(apt.type)) continue;

    const configs = PROACTIVE_CHECKIN_CONFIG.filter((c) => c.eventType === apt.type);
    
    for (const config of configs) {
      const eventDate = apt.date || addDays(cycleStartDate, apt.dayOffset);
      const eventDateInTz = toZonedTime(eventDate, timezone);
      
      const checkInTime = addHours(eventDateInTz, config.delayHours);

      const existing = await prisma.insight_ProactiveCheckIn.findFirst({
        where: {
          userId,
          cycleId,
          eventType: apt.type,
          scheduledFor: checkInTime,
        },
      });

      if (!existing) {
        await prisma.insight_ProactiveCheckIn.create({
          data: {
            userId,
            cycleId,
            eventType: apt.type,
            scheduledFor: checkInTime,
            displayInUI: config.displayInUI,
          },
        });
        scheduled++;
      }
    }
  }

  return scheduled;
}

export async function createProactiveCheckInTasks(
  userId: string,
  cycleId: string,
  appointments: Array<{
    type: string;
    date: Date | null;
    dayOffset: number;
  }>,
  cycleStartDate: Date,
  timezone: string
): Promise<number> {
  let created = 0;

  for (const apt of appointments) {
    if (!BIG_EVENT_TYPES.includes(apt.type)) continue;

    const configs = PROACTIVE_CHECKIN_CONFIG.filter((c) => c.eventType === apt.type);

    for (const config of configs) {
      const eventDate = apt.date || addDays(cycleStartDate, apt.dayOffset);
      const eventDateInTz = toZonedTime(eventDate, timezone);
      
      const checkInTime = addHours(eventDateInTz, config.delayHours);
      const planDayDate = startOfDay(checkInTime);

      // Use transaction for atomic PlanDay + Task creation
      const wasCreated = await prisma.$transaction(async (tx) => {
        // Check for existing task to prevent duplicates
        const existingTask = await tx.task.findFirst({
          where: {
            cycleId,
            kind: "PROACTIVE_CHECKIN",
            dueAt: checkInTime,
          },
        });

        if (existingTask) return false;

        let planDay = await tx.planDay.findFirst({
          where: { cycleId, date: planDayDate },
        });

        if (!planDay) {
          const cycleDayIndex = Math.floor(
            (planDayDate.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          planDay = await tx.planDay.create({
            data: {
              cycleId,
              date: planDayDate,
              cycleDayIndex,
              title: `Day ${cycleDayIndex}`,
            },
          });
        }

        await tx.task.create({
          data: {
            cycleId,
            planDayId: planDay.id,
            kind: "PROACTIVE_CHECKIN",
            label: config.message,
            dueAt: checkInTime,
            displayInUpcoming: config.displayInUI,
            meta: {
              eventType: apt.type,
              isProactive: true,
            },
          },
        });

        return true;
      });

      if (wasCreated) created++;
    }
  }

  return created;
}

export async function getDueProactiveCheckIns(): Promise<
  Array<{
    id: string;
    userId: string;
    cycleId: string;
    eventType: string;
    scheduledFor: Date;
  }>
> {
  const now = new Date();
  const lookAhead = new Date(now.getTime() + 5 * 60 * 1000);

  return prisma.insight_ProactiveCheckIn.findMany({
    where: {
      sent: false,
      scheduledFor: { lte: lookAhead },
    },
  });
}

export async function markProactiveCheckInSent(id: string): Promise<void> {
  await prisma.insight_ProactiveCheckIn.update({
    where: { id },
    data: {
      sent: true,
      sentAt: new Date(),
    },
  });
}
