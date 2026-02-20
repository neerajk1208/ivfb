import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import { checkInCreateSchema } from "@/lib/validate";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";
import { createCheckIn } from "@/modules/checkins/checkinService";

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
    const parsed = checkInCreateSchema.safeParse(dataWithCycle);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const result = await createCheckIn(user.id, parsed.data);

    return successResponse(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Check-in create error:", error);
    return serverErrorResponse();
  }
}
