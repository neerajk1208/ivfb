import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();

    const subscriptionCount = await prisma.pushSubscription.count({
      where: { userId: user.id },
    });

    return successResponse({
      enabled: subscriptionCount > 0,
      subscriptionCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Push status error:", error);
    return serverErrorResponse();
  }
}
