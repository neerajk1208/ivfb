import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { getDailyContext, checkDailyLimit, getUnreadCount } from "@/modules/chat/chatService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const cycle = await getActiveCycle(user.id);

    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    
    const date = dateParam ? new Date(dateParam) : new Date();

    const context = await getDailyContext(cycle.id, date, user.timezone);
    const limitCheck = await checkDailyLimit(user.id, user.timezone);
    const unreadCount = await getUnreadCount(user.id, cycle.id);

    return successResponse({
      context,
      remainingMessages: limitCheck.remaining,
      unreadCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Get chat context error:", error);
    return serverErrorResponse();
  }
}
