import { requireUser } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        calendarRefreshToken: true,
        calendarConnectedAt: true,
      },
    });

    return successResponse({
      connected: !!userData?.calendarRefreshToken,
      connectedAt: userData?.calendarConnectedAt,
      email: userData?.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Calendar status error:", error);
    return serverErrorResponse();
  }
}
