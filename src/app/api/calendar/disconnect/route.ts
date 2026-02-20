import { requireUser } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { disconnectCalendar } from "@/modules/calendar/calendarService";

export async function POST() {
  try {
    const user = await requireUser();

    await disconnectCalendar(user.id);

    return successResponse({ disconnected: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Calendar disconnect error:", error);
    return serverErrorResponse();
  }
}
