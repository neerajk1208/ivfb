import { prisma } from "@/lib/db";
import { subDays, parseISO, format } from "date-fns";
import type { ProtocolPlanExtraction } from "./protocolSchemas";

/**
 * Validates and corrects trigger date based on retrieval date.
 * Trigger shot is always ~36 hours before retrieval, so trigger date = retrieval date - 2 days.
 * This corrects AI extraction errors where trigger date may be off by 1-7 days.
 */
function validateTriggerDate(
  appointments: ProtocolPlanExtraction["appointments"]
): ProtocolPlanExtraction["appointments"] {
  if (!appointments || appointments.length === 0) return appointments;

  const retrievalAppt = appointments.find((a) =>
    /retrieval|vor|egg.?retrieval/i.test(a.type)
  );
  const triggerAppt = appointments.find((a) => /trigger/i.test(a.type));

  if (!retrievalAppt || !triggerAppt) return appointments;

  const retrievalDate = (retrievalAppt as any).date;
  if (!retrievalDate) return appointments;

  // Calculate expected trigger date: retrieval - 2 days
  const retrievalParsed = parseISO(retrievalDate);
  const expectedTrigger = subDays(retrievalParsed, 2);
  const expectedTriggerStr = format(expectedTrigger, "yyyy-MM-dd");

  // Update trigger date to the expected value
  (triggerAppt as any).date = expectedTriggerStr;

  return appointments;
}

export interface SaveProtocolDraftInput {
  cycleId: string;
  source: "UPLOAD" | "INTAKE";
  extraction: ProtocolPlanExtraction;
  rawDocumentUrl?: string;
}

export async function saveProtocolPlanDraft(input: SaveProtocolDraftInput) {
  const { cycleId, source, extraction, rawDocumentUrl } = input;

  const existingPlan = await prisma.protocolPlan.findUnique({
    where: { cycleId },
  });

  if (existingPlan) {
    // Delete protocol-related data
    await prisma.medication.deleteMany({
      where: { protocolPlanId: existingPlan.id },
    });
    await prisma.appointment.deleteMany({
      where: { protocolPlanId: existingPlan.id },
    });
    await prisma.milestone.deleteMany({
      where: { protocolPlanId: existingPlan.id },
    });
    await prisma.protocolPlan.delete({
      where: { id: existingPlan.id },
    });

    // Delete cycle-related data that needs to be regenerated
    // (Tasks, PlanDays, CheckIns, ConversationState)
    // Keep: ChatMessages (conversation history), Insight_* tables (user memories)
    await prisma.task.deleteMany({
      where: { cycleId },
    });
    await prisma.planDay.deleteMany({
      where: { cycleId },
    });
    await prisma.checkIn.deleteMany({
      where: { cycleId },
    });
    await prisma.conversationState.deleteMany({
      where: { cycleId },
    });
  }

  // Validate trigger date based on retrieval date (biological constraint)
  const validatedAppointments = validateTriggerDate(extraction.appointments);

  const cycleStartDate = extraction.cycleStartDate
    ? new Date(extraction.cycleStartDate)
    : new Date();

  const protocolPlan = await prisma.protocolPlan.create({
    data: {
      cycleId,
      status: "DRAFT",
      source,
      cycleStartDate,
      notes: extraction.notes,
      rawDocumentUrl: rawDocumentUrl || null,
      structuredData: { ...extraction, appointments: validatedAppointments } as any,
      medications: {
        create: extraction.medications.map((med) => ({
          name: med.name,
          dosageAmount: med.dosageAmount,
          dosageUnit: med.dosageUnit,
          unitStrength: (med as any).unitStrength || null,
          dosage: med.dosage,
          frequency: med.frequency || "once_daily",
          route: med.route,
          startDate: (med as any).startDate ? new Date((med as any).startDate) : null,
          endDate: (med as any).endDate ? new Date((med as any).endDate) : null,
          startDayOffset: med.startDayOffset ?? 0,
          durationDays: med.durationDays ?? 1,
          timeOfDay: med.timeOfDay,
          exactTime: med.exactTime,
          doses: (med as any).doses ? ((med as any).doses as any) : undefined,
          instructions: med.instructions,
        })),
      },
      appointments: {
        create: (validatedAppointments || []).map((apt) => ({
          type: apt.type,
          date: (apt as any).date ? new Date((apt as any).date) : null,
          dayOffset: apt.dayOffset ?? 0,
          exactTime: apt.exactTime,
          notes: apt.notes,
          fasting: apt.fasting || false,
          critical: apt.critical || false,
        })),
      },
      milestones: {
        create: (extraction.milestones || []).map((ms) => ({
          type: ms.type,
          dayOffset: ms.dayOffset,
          label: ms.label,
          details: ms.details,
        })),
      },
    },
    include: {
      medications: true,
      appointments: true,
      milestones: true,
    },
  });

  return protocolPlan;
}

export async function activateProtocolPlan(protocolPlanId: string) {
  return prisma.protocolPlan.update({
    where: { id: protocolPlanId },
    data: { status: "ACTIVE" },
    include: {
      medications: true,
      appointments: true,
      milestones: true,
      cycle: true,
    },
  });
}

export interface DoseInput {
  doseNumber: number;
  timeOfDay?: string | null;
  exactTime?: string | null;
}

export interface MedicationInput {
  name: string;
  dosageAmount?: number | null;
  dosageUnit?: string | null;
  unitStrength?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startDayOffset: number;
  durationDays: number;
  timeOfDay?: string | null;
  exactTime?: string | null;
  doses?: DoseInput[] | null;
  instructions?: string | null;
}

export interface AppointmentInput {
  type: string;
  date?: string | null;
  dayOffset: number;
  exactTime?: string | null;
  notes?: string | null;
  fasting?: boolean;
  critical?: boolean;
}

export async function updateProtocolPlanFromReview(
  protocolPlanId: string,
  data: {
    cycleStartDate: string;
    medications: MedicationInput[];
    appointments?: AppointmentInput[];
    notes?: string | null;
  }
) {
  await prisma.medication.deleteMany({
    where: { protocolPlanId },
  });
  await prisma.appointment.deleteMany({
    where: { protocolPlanId },
  });
  await prisma.milestone.deleteMany({
    where: { protocolPlanId },
  });

  const existingPlan = await prisma.protocolPlan.findUnique({
    where: { id: protocolPlanId },
  });

  if (!existingPlan) {
    throw new Error("Protocol plan not found");
  }

  const updatedStructuredData = {
    ...(existingPlan.structuredData as any),
    cycleStartDate: data.cycleStartDate,
    medications: data.medications,
    appointments: data.appointments || [],
    notes: data.notes,
  };

  return prisma.protocolPlan.update({
    where: { id: protocolPlanId },
    data: {
      cycleStartDate: new Date(data.cycleStartDate),
      notes: data.notes,
      structuredData: updatedStructuredData,
      medications: {
        create: data.medications.map((med) => ({
          name: med.name,
          dosageAmount: med.dosageAmount || null,
          dosageUnit: med.dosageUnit || null,
          unitStrength: med.unitStrength || null,
          dosage: med.dosage || null,
          frequency: med.frequency || "once_daily",
          route: med.route || null,
          startDate: med.startDate ? new Date(med.startDate) : null,
          endDate: med.endDate ? new Date(med.endDate) : null,
          startDayOffset: med.startDayOffset,
          durationDays: med.durationDays,
          timeOfDay: med.timeOfDay || null,
          exactTime: med.exactTime || null,
          doses: med.doses ? (med.doses as any) : undefined,
          instructions: med.instructions || null,
        })),
      },
      appointments: {
        create: (data.appointments || []).map((apt) => ({
          type: apt.type,
          date: apt.date ? new Date(apt.date) : null,
          dayOffset: apt.dayOffset,
          exactTime: apt.exactTime || null,
          notes: apt.notes || null,
          fasting: apt.fasting || false,
          critical: apt.critical || false,
        })),
      },
    },
    include: {
      medications: true,
      appointments: true,
      milestones: true,
    },
  });
}
