import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { syncAppointmentsToCalendar, isCalendarConnected } from "@/modules/calendar/calendarService";

export async function POST() {
  try {
    const user = await requireUser();
    const cycle = await getActiveCycle(user.id);

    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    const connected = await isCalendarConnected(user.id);
    if (!connected) {
      return errorResponse("Calendar not connected");
    }

    const result = await syncAppointmentsToCalendar(user.id, cycle.id);

    return successResponse({
      message: `Synced ${result.synced} appointments to Google Calendar`,
      synced: result.synced,
      failed: result.failed,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Calendar sync error:", error);
    return serverErrorResponse();
  }
}
