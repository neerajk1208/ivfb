import { requireUser } from "@/lib/auth";
import { sendSms } from "@/modules/messaging/messagingService";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";

export async function POST() {
  try {
    const user = await requireUser();

    if (!user.phoneE164) {
      return errorResponse("No phone number on file");
    }

    const result = await sendSms({
      userId: user.id,
      toNumber: user.phoneE164,
      body: "💛 Test from IVF Buddy! Your SMS is working. Reply with a number 1-5 to test the buddy AI response.",
    });

    if (result.success) {
      return successResponse({ message: "SMS sent!", messageId: result.messageId });
    } else {
      return errorResponse(`SMS failed: ${result.error}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Test SMS error:", error);
    return serverErrorResponse();
  }
}
