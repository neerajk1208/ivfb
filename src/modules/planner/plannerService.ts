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
import { createProactiveCheckInTasks } from "@/modules/insights/proactiveCheckinService";

interface GenerateTasksInput {
  userId: string;
  cycleId: string;
  protocolPlanId: string;
  userTimezone: string;
  quietHours?: { start: string; end: string } | null;
}

interface Dose {
  doseNumber: number;
  timeOfDay: string | null;
  exactTime: string | null;
}

function formatMedicationLabel(
  med: {
    name: string;
    dosageAmount: number | null;
    dosageUnit: string | null;
    unitStrength?: string | null;
    dosage: string | null;
  },
  doseNumber?: number,
  totalDoses?: number
): string {
  let label = med.name;
  
  if (med.dosageAmount && med.dosageUnit) {
    if (med.unitStrength) {
      label = `${med.name} ${med.dosageAmount} ${med.dosageUnit} (${med.unitStrength} each)`;
    } else {
      label = `${med.name} ${med.dosageAmount} ${med.dosageUnit}`;
    }
  } else if (med.dosage) {
    label = `${med.name} ${med.dosage}`;
  }
  
  if (doseNumber && totalDoses && totalDoses > 1) {
    label = `${label} (Dose ${doseNumber}/${totalDoses})`;
  }
  
  return label;
}

export async function generatePlanTasks(input: GenerateTasksInput) {
  const { userId, cycleId, protocolPlanId, userTimezone, quietHours } = input;

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
    timeWindow?: { start: string; end: string };
    meta?: any;
  }> = [];

  const parseDbDate = (d: Date | string): Date => {
    const str = typeof d === 'string' ? d : d.toISOString();
    const [year, month, day] = str.split("T")[0].split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const isSameDay = (d1: Date, d2: Date): boolean => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  for (let i = 0; i < appConfig.planDaysAhead; i++) {
    const date = addDays(today, i);
    const cycleDayIndex = getCycleDayIndex(cycleStartDate, date);

    planDays.push({
      date: fromZonedTime(date, userTimezone),
      cycleDayIndex,
      title: `Day ${cycleDayIndex}`,
      summary: null,
    });

    // Generate medication tasks using actual dates
    for (const med of protocol.medications) {
      const medStartDate = med.startDate ? parseDbDate(med.startDate) : addDays(cycleStartDate, med.startDayOffset);
      const medEndDate = med.endDate ? parseDbDate(med.endDate) : addDays(medStartDate, med.durationDays - 1);

      if (date >= medStartDate && date <= medEndDate) {
        const doses = (med.doses as Dose[] | null) || null;
        const medWithStrength = med as typeof med & { unitStrength?: string | null };
        
        if (doses && doses.length > 0) {
          for (const dose of doses) {
            let dueAt = createDueAtTime(
              date,
              dose.timeOfDay,
              dose.exactTime,
              userTimezone
            );

            dueAt = pushOutOfQuietHours(dueAt, quietHours || null, userTimezone);

            if (dueAt > new Date()) {
              tasks.push({
                planDayDate: fromZonedTime(date, userTimezone),
                kind: "REMINDER",
                label: formatMedicationLabel(medWithStrength, dose.doseNumber, doses.length),
                dueAt,
                meta: {
                  medicationId: med.id,
                  medicationName: med.name,
                  dosageAmount: med.dosageAmount,
                  dosageUnit: med.dosageUnit,
                  unitStrength: medWithStrength.unitStrength,
                  dosage: med.dosage,
                  frequency: med.frequency,
                  route: med.route,
                  instructions: med.instructions,
                  doseNumber: dose.doseNumber,
                  totalDoses: doses.length,
                },
              });
            }
          }
        } else {
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
              label: formatMedicationLabel(medWithStrength),
              dueAt,
              meta: {
                medicationId: med.id,
                medicationName: med.name,
                dosageAmount: med.dosageAmount,
                dosageUnit: med.dosageUnit,
                unitStrength: medWithStrength.unitStrength,
                dosage: med.dosage,
                frequency: med.frequency,
                route: med.route,
                instructions: med.instructions,
              },
            });
          }
        }
      }
    }

    // Generate appointment tasks using actual dates (all-day, no specific time)
    for (const apt of protocol.appointments) {
      const aptDate = apt.date ? parseDbDate(apt.date) : addDays(cycleStartDate, apt.dayOffset);
      
      if (isSameDay(date, aptDate)) {
        // For appointments: use exactTime if provided, otherwise set to start of day for sorting
        // but mark as all-day event
        const hasTime = !!apt.exactTime;
        const aptTime = hasTime 
          ? createDueAtTime(date, null, apt.exactTime, userTimezone)
          : createDueAtTime(date, "morning", null, userTimezone);

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
              exactTime: apt.exactTime,
              isAllDay: !hasTime,
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

  // Schedule proactive check-ins after big events (retrieval, transfer, trigger)
  const proactiveCheckInsCreated = await createProactiveCheckInTasks(
    userId,
    cycleId,
    protocol.appointments.map((a) => ({
      type: a.type,
      date: a.date,
      dayOffset: a.dayOffset,
    })),
    protocol.cycleStartDate,
    userTimezone
  );

  return {
    planDaysCreated: planDays.length,
    tasksCreated: tasks.length + proactiveCheckInsCreated,
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
