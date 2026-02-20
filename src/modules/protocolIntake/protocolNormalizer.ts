import { prisma } from "@/lib/db";
import type { ProtocolPlanExtraction } from "./protocolSchemas";

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
  }

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
      structuredData: extraction as any,
      medications: {
        create: extraction.medications.map((med) => ({
          name: med.name,
          dosageAmount: med.dosageAmount,
          dosageUnit: med.dosageUnit,
          dosage: med.dosage,
          frequency: med.frequency || "once_daily",
          route: med.route,
          startDayOffset: med.startDayOffset,
          durationDays: med.durationDays,
          timeOfDay: med.timeOfDay,
          exactTime: med.exactTime,
          instructions: med.instructions,
        })),
      },
      appointments: {
        create: (extraction.appointments || []).map((apt) => ({
          type: apt.type,
          dayOffset: apt.dayOffset,
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

export interface MedicationInput {
  name: string;
  dosageAmount?: number | null;
  dosageUnit?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  route?: string | null;
  startDayOffset: number;
  durationDays: number;
  timeOfDay?: string | null;
  exactTime?: string | null;
  instructions?: string | null;
}

export interface AppointmentInput {
  type: string;
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
          dosage: med.dosage || null,
          frequency: med.frequency || "once_daily",
          route: med.route || null,
          startDayOffset: med.startDayOffset,
          durationDays: med.durationDays,
          timeOfDay: med.timeOfDay || null,
          exactTime: med.exactTime || null,
          instructions: med.instructions || null,
        })),
      },
      appointments: {
        create: (data.appointments || []).map((apt) => ({
          type: apt.type,
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
