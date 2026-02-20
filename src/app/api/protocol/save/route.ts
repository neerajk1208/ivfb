import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import { protocolSaveSchema } from "@/lib/validate";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";
import { saveProtocolPlanDraft } from "@/modules/protocolIntake/protocolNormalizer";
import type { ProtocolPlanExtraction } from "@/modules/protocolIntake/protocolSchemas";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const cycle = await getActiveCycle(user.id);
    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    const dataWithCycle = { ...body, cycleId: cycle.id };
    const parsed = protocolSaveSchema.safeParse(dataWithCycle);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const extraction: ProtocolPlanExtraction = {
      cycleStartDate: parsed.data.cycleStartDate,
      medications: parsed.data.medications.map((m) => ({
        name: m.name,
        dosageAmount: null,
        dosageUnit: null,
        dosage: m.dosage || null,
        frequency: "once_daily",
        route: null,
        startDayOffset: m.startDayOffset,
        durationDays: m.durationDays,
        timeOfDay: (m.timeOfDay as "morning" | "afternoon" | "evening" | "bedtime") || null,
        exactTime: m.customTime || null,
        instructions: m.instructions || null,
      })),
      appointments: [],
      milestones: (parsed.data.milestones || []).map((ms) => ({
        type: ms.type as "CYCLE_START" | "STIM_START" | "TRIGGER" | "RETRIEVAL" | "TRANSFER" | "PREG_TEST" | "OTHER",
        dayOffset: ms.dayOffset,
        label: ms.label || null,
        details: ms.details || null,
      })),
      notes: parsed.data.notes || null,
      confidence: {
        cycleStartDate: "high",
        medications: "high",
        appointments: "high",
      },
      missingFields: [],
    };

    const source = (body as any).source === "INTAKE" ? "INTAKE" : "UPLOAD";

    const protocolPlan = await saveProtocolPlanDraft({
      cycleId: cycle.id,
      source,
      extraction,
    });

    return successResponse({
      protocolPlanId: protocolPlan.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Protocol save error:", error);
    return serverErrorResponse();
  }
}
