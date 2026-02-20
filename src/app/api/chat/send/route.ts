import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";
import { sendUserMessage, checkDailyLimit } from "@/modules/chat/chatService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const cycle = await getActiveCycle(user.id);

    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    const body = await parseJsonBody(request) as { content?: string } | null;
    if (!body || !body.content || typeof body.content !== "string") {
      return errorResponse("Message content is required");
    }

    const content = body.content.trim();
    if (content.length === 0) {
      return errorResponse("Message cannot be empty");
    }

    if (content.length > 1000) {
      return errorResponse("Message too long (max 1000 characters)");
    }

    const result = await sendUserMessage(
      user.id,
      cycle.id,
      content,
      user.timezone
    );

    const limitCheck = await checkDailyLimit(user.id, user.timezone);

    return successResponse({
      userMessage: result.userMessage,
      buddyReply: result.buddyReply,
      limitReached: result.limitReached,
      remainingMessages: limitCheck.remaining,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Send chat message error:", error);
    return serverErrorResponse();
  }
}
