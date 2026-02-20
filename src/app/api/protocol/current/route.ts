import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const cycle = await getActiveCycle(user.id);

    if (!cycle || !cycle.protocol) {
      return notFoundResponse("Protocol");
    }

    return successResponse({
      id: cycle.protocol.id,
      cycleStartDate: cycle.protocol.cycleStartDate.toISOString(),
      status: cycle.protocol.status,
      source: cycle.protocol.source,
      notes: cycle.protocol.notes,
      structuredData: cycle.protocol.structuredData,
      medications: cycle.protocol.medications,
      milestones: cycle.protocol.milestones,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Get protocol error:", error);
    return serverErrorResponse();
  }
}
