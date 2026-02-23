import { requireUser, getActiveCycle } from "@/lib/auth";
import { parseJsonBody } from "@/lib/http";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { syncToCalendar, isCalendarConnected } from "@/modules/calendar/calendarService";

export async function POST(request: Request) {
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

    const body = await parseJsonBody<{ includeMedications?: boolean }>(request);
    const includeMedications = body?.includeMedications ?? false;

    const result = await syncToCalendar(user.id, cycle.id, { includeMedications });

    const itemType = includeMedications ? "events" : "appointments";
    return successResponse({
      message: `Synced ${result.synced} ${itemType} to Google Calendar`,
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
