import { prisma } from "@/lib/db";
import { addDays, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  createDueAtTime,
  getCycleDayIndex,
  pushOutOfQuietHours,
  DEFAULT_TIMES,
} from "@/lib/time";
import { appConfig } from "@/config/app";

interface GenerateTasksInput {
  cycleId: string;
  protocolPlanId: string;
  userTimezone: string;
  quietHours?: { start: string; end: string } | null;
}

function formatMedicationLabel(med: {
  name: string;
  dosageAmount: number | null;
  dosageUnit: string | null;
  dosage: string | null;
}): string {
  if (med.dosageAmount && med.dosageUnit) {
    return `${med.name} ${med.dosageAmount} ${med.dosageUnit}`;
  }
  if (med.dosage) {
    return `${med.name} ${med.dosage}`;
  }
  return med.name;
}

export async function generatePlanTasks(input: GenerateTasksInput) {
  const { cycleId, protocolPlanId, userTimezone, quietHours } = input;

  const protocol = await prisma.protocolPlan.findUnique({
    where: { id: protocolPlanId },
    include: {
      medications: true,
      appointments: true,
      milestones: true,
    },
  });

  if (!protocol) {
    throw new Error("Protocol plan not found");
  }

  await prisma.task.deleteMany({
    where: {
      cycleId,
      dueAt: { gte: new Date() },
    },
  });

  await prisma.planDay.deleteMany({
    where: {
      cycleId,
      date: { gte: startOfDay(new Date()) },
    },
  });

  const today = toZonedTime(new Date(), userTimezone);
  today.setHours(0, 0, 0, 0);

  const cycleStartDate = toZonedTime(protocol.cycleStartDate, userTimezone);
  cycleStartDate.setHours(0, 0, 0, 0);

  const planDays: Array<{
    date: Date;
    cycleDayIndex: number;
    title: string;
    summary: string | null;
  }> = [];

  const tasks: Array<{
    planDayDate: Date;
    kind: string;
    label: string;
    dueAt: Date;
    meta?: any;
  }> = [];

  for (let i = 0; i < appConfig.planDaysAhead; i++) {
    const date = addDays(today, i);
    const cycleDayIndex = getCycleDayIndex(cycleStartDate, date);

    planDays.push({
      date: fromZonedTime(date, userTimezone),
      cycleDayIndex,
      title: `Day ${cycleDayIndex}`,
      summary: null,
    });

    // Generate medication tasks
    for (const med of protocol.medications) {
      const medStartDay = med.startDayOffset;
      const medEndDay = med.startDayOffset + med.durationDays - 1;

      if (cycleDayIndex >= medStartDay && cycleDayIndex <= medEndDay) {
        let dueAt = createDueAtTime(
          date,
          med.timeOfDay,
          med.exactTime,
          userTimezone
        );

        dueAt = pushOutOfQuietHours(dueAt, quietHours || null, userTimezone);

        if (dueAt > new Date()) {
          tasks.push({
            planDayDate: fromZonedTime(date, userTimezone),
            kind: "REMINDER",
            label: formatMedicationLabel(med),
            dueAt,
            meta: {
              medicationId: med.id,
              medicationName: med.name,
              dosageAmount: med.dosageAmount,
              dosageUnit: med.dosageUnit,
              dosage: med.dosage,
              frequency: med.frequency,
              route: med.route,
              instructions: med.instructions,
            },
          });
        }
      }
    }

    // Generate appointment tasks
    for (const apt of protocol.appointments) {
      if (cycleDayIndex === apt.dayOffset) {
        const aptTime = createDueAtTime(
          date,
          apt.critical ? null : "morning",
          apt.exactTime,
          userTimezone
        );

        if (aptTime > new Date()) {
          const aptLabel = getAppointmentLabel(apt.type);
          tasks.push({
            planDayDate: fromZonedTime(date, userTimezone),
            kind: apt.critical ? "CRITICAL" : "APPOINTMENT",
            label: apt.fasting ? `${aptLabel} (fasting)` : aptLabel,
            dueAt: aptTime,
            meta: {
              appointmentId: apt.id,
              type: apt.type,
              notes: apt.notes,
              fasting: apt.fasting,
              critical: apt.critical,
            },
          });
        }
      }
    }

    // Generate milestone tasks
    for (const milestone of protocol.milestones) {
      if (cycleDayIndex === milestone.dayOffset) {
        const milestoneTime = createDueAtTime(
          date,
          "morning",
          null,
          userTimezone
        );

        if (milestoneTime > new Date()) {
          tasks.push({
            planDayDate: fromZonedTime(date, userTimezone),
            kind: "INFO",
            label: milestone.label || `${milestone.type}`,
            dueAt: milestoneTime,
            meta: {
              milestoneId: milestone.id,
              type: milestone.type,
              details: milestone.details,
            },
          });
        }
      }
    }

    // Generate daily check-in task
    const checkinTime = createDueAtTime(
      date,
      null,
      `${DEFAULT_TIMES.checkin.hour.toString().padStart(2, "0")}:${DEFAULT_TIMES.checkin.minute.toString().padStart(2, "0")}`,
      userTimezone
    );

    const adjustedCheckinTime = pushOutOfQuietHours(
      checkinTime,
      quietHours || null,
      userTimezone
    );

    if (adjustedCheckinTime > new Date()) {
      tasks.push({
        planDayDate: fromZonedTime(date, userTimezone),
        kind: "CHECKIN",
        label: "How are you feeling today?",
        dueAt: adjustedCheckinTime,
      });
    }
  }

  const createdPlanDays = await Promise.all(
    planDays.map((pd) =>
      prisma.planDay.create({
        data: {
          cycleId,
          date: pd.date,
          cycleDayIndex: pd.cycleDayIndex,
          title: pd.title,
          summary: pd.summary,
        },
      })
    )
  );

  const planDayMap = new Map(
    createdPlanDays.map((pd) => [pd.date.toISOString().split("T")[0], pd.id])
  );

  await Promise.all(
    tasks.map((task) => {
      const dateKey = task.planDayDate.toISOString().split("T")[0];
      const planDayId = planDayMap.get(dateKey);

      return prisma.task.create({
        data: {
          cycleId,
          planDayId: planDayId || null,
          kind: task.kind,
          label: task.label,
          dueAt: task.dueAt,
          status: "PENDING",
          meta: task.meta || null,
        },
      });
    })
  );

  return {
    planDaysCreated: planDays.length,
    tasksCreated: tasks.length,
  };
}

function getAppointmentLabel(type: string): string {
  const labels: Record<string, string> = {
    BLOODWORK: "Bloodwork",
    ULTRASOUND: "Ultrasound",
    MONITORING: "Monitoring (BW + US)",
    TRIGGER: "Trigger Shot",
    RETRIEVAL: "Egg Retrieval",
    TRANSFER: "Embryo Transfer",
    CONSULTATION: "Consultation",
    OTHER: "Appointment",
  };
  return labels[type] || type;
}
