import { NextRequest } from "next/server";
import { runSchedulerTick } from "@/modules/tasks/scheduler";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    const result = await runSchedulerTick();

    return successResponse(result);
  } catch (error) {
    console.error("Tick job error:", error);
    return serverErrorResponse();
  }
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return errorResponse("Method not allowed", 405);
  }

  return POST(request);
}
