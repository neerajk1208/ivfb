import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { getTodayTasks, getUpcomingTasks } from "@/modules/tasks/taskService";
import { getTodayCheckIn } from "@/modules/checkins/checkinService";
import { getCycleDayIndex, getTodayInTimezone } from "@/lib/time";
import { toZonedTime } from "date-fns-tz";

export async function GET() {
  try {
    const user = await requireUser();
    const cycle = await getActiveCycle(user.id);

    if (!cycle || !cycle.protocol || cycle.protocol.status !== "ACTIVE") {
      return errorResponse("No active protocol", 400);
    }

    const today = getTodayInTimezone(user.timezone);
    const cycleStartDate = toZonedTime(cycle.protocol.cycleStartDate, user.timezone);
    cycleStartDate.setHours(0, 0, 0, 0);

    const cycleDayIndex = getCycleDayIndex(cycleStartDate, today);

    const [tasks, upcomingTasks, todayCheckIn] = await Promise.all([
      getTodayTasks(cycle.id),
      getUpcomingTasks(cycle.id, 10),
      getTodayCheckIn(user.id, cycle.id),
    ]);

    return successResponse({
      cycleDayIndex,
      cycleStartDate: cycle.protocol.cycleStartDate.toISOString(),
      tasks: tasks.map((t) => ({
        id: t.id,
        kind: t.kind,
        label: t.label,
        dueAt: t.dueAt?.toISOString(),
        status: t.status,
      })),
      upcomingTasks: upcomingTasks
        .filter((t) => {
          const taskDate = t.dueAt ? new Date(t.dueAt) : null;
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          return taskDate && taskDate > todayEnd;
        })
        .map((t) => ({
          id: t.id,
          kind: t.kind,
          label: t.label,
          dueAt: t.dueAt?.toISOString(),
          status: t.status,
        })),
      todayCheckIn: todayCheckIn
        ? {
            mood: todayCheckIn.mood,
            symptoms: todayCheckIn.symptoms,
            note: todayCheckIn.note,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Today API error:", error);
    return serverErrorResponse();
  }
}
