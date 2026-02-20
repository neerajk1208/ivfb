import { requireUser } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { sendPushToUser } from "@/modules/push/pushService";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const user = await requireUser();

    const subCount = await prisma.pushSubscription.count({
      where: { userId: user.id },
    });

    if (subCount === 0) {
      return errorResponse("No push subscription found. Enable notifications first.");
    }

    const result = await sendPushToUser(user.id, {
      title: "🎉 Test Notification",
      body: "Push notifications are working! You'll receive reminders here.",
      url: "/chat",
      tag: "test",
    });

    if (result.sent === 0) {
      return errorResponse(result.errors[0] || "Failed to send push notification");
    }

    return successResponse({ message: "Test push sent!" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Test push error:", error);
    return serverErrorResponse();
  }
}
