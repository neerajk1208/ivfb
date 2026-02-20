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
    
    // Use date string directly (YYYY-MM-DD format)
    const today = new Date();
    const dateString = dateParam || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const messages = await getMessagesForDate(
      user.id,
      cycle.id,
      dateString,
      user.timezone
    );

    await markMessagesAsRead(user.id, cycle.id, dateString, user.timezone);

    return successResponse({ messages });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Get chat messages error:", error);
    return serverErrorResponse();
  }
}
