import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";
import {
  updateProtocolPlanFromReview,
  activateProtocolPlan,
} from "@/modules/protocolIntake/protocolNormalizer";
import { generatePlanTasks } from "@/modules/planner/plannerService";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const { protocolPlanId, cycleStartDate, medications, milestones, notes } =
      body as any;

    if (!protocolPlanId || !cycleStartDate || !medications) {
      return errorResponse("Missing required fields");
    }

    const cycle = await getActiveCycle(user.id);
    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    if (cycle.protocol?.id !== protocolPlanId) {
      return notFoundResponse("Protocol");
    }

    await updateProtocolPlanFromReview(protocolPlanId, {
      cycleStartDate,
      medications,
      milestones,
      notes,
    });

    await activateProtocolPlan(protocolPlanId);

    await prisma.cycle.update({
      where: { id: cycle.id },
      data: {
        startDate: new Date(cycleStartDate),
      },
    });

    const result = await generatePlanTasks({
      cycleId: cycle.id,
      protocolPlanId,
      userTimezone: user.timezone,
      quietHours: user.quietHours as { start: string; end: string } | null,
    });

    return successResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Protocol confirm error:", error);
    return serverErrorResponse();
  }
}
