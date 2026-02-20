import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { getMessagesForDate, markMessagesAsRead } from "@/modules/chat/chatService";

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

    const messages = await getMessagesForDate(
      user.id,
      cycle.id,
      date,
      user.timezone
    );

    await markMessagesAsRead(user.id, cycle.id, date, user.timezone);

    return successResponse({ messages });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Get chat messages error:", error);
    return serverErrorResponse();
  }
}
