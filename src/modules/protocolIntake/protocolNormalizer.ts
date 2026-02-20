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
          dosage: med.dosage,
          startDayOffset: med.startDayOffset,
          durationDays: med.durationDays,
          timeOfDay: med.timeOfDay,
          customTime: med.customTime,
          instructions: med.instructions,
        })),
      },
      milestones: {
        create: extraction.milestones.map((ms) => ({
          type: ms.type,
          dayOffset: ms.dayOffset,
          label: ms.label,
          details: ms.details,
        })),
      },
    },
    include: {
      medications: true,
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
      milestones: true,
      cycle: true,
    },
  });
}

export async function updateProtocolPlanFromReview(
  protocolPlanId: string,
  data: {
    cycleStartDate: string;
    medications: Array<{
      name: string;
      dosage?: string | null;
      startDayOffset: number;
      durationDays: number;
      timeOfDay?: string | null;
      customTime?: string | null;
      instructions?: string | null;
    }>;
    milestones?: Array<{
      type: string;
      dayOffset: number;
      label?: string | null;
      details?: string | null;
    }>;
    notes?: string | null;
  }
) {
  await prisma.medication.deleteMany({
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
    milestones: data.milestones || [],
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
          dosage: med.dosage || null,
          startDayOffset: med.startDayOffset,
          durationDays: med.durationDays,
          timeOfDay: med.timeOfDay || null,
          customTime: med.customTime || null,
          instructions: med.instructions || null,
        })),
      },
      milestones: {
        create: (data.milestones || []).map((ms) => ({
          type: ms.type,
          dayOffset: ms.dayOffset,
          label: ms.label || null,
          details: ms.details || null,
        })),
      },
    },
    include: {
      medications: true,
      milestones: true,
    },
  });
}
