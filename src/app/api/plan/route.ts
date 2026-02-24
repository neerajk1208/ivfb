import { requireUser, getActiveCycle } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const cycle = await getActiveCycle(user.id);

    if (!cycle || !cycle.protocol) {
      return notFoundResponse("No active protocol found");
    }

    const protocol = cycle.protocol;

    // Sort medications by startDayOffset
    const medications = [...protocol.medications].sort(
      (a, b) => a.startDayOffset - b.startDayOffset
    );

    // Sort appointments by dayOffset
    const appointments = [...protocol.appointments].sort(
      (a, b) => a.dayOffset - b.dayOffset
    );

    return successResponse({
      cycleStartDate: protocol.cycleStartDate.toISOString(),
      medications: medications.map((m) => ({
        id: m.id,
        name: m.name,
        dosageAmount: m.dosageAmount,
        dosageUnit: m.dosageUnit,
        unitStrength: m.unitStrength,
        dosage: m.dosage,
        frequency: m.frequency,
        route: m.route,
        startDate: m.startDate?.toISOString() || null,
        endDate: m.endDate?.toISOString() || null,
        startDayOffset: m.startDayOffset,
        durationDays: m.durationDays,
        timeOfDay: m.timeOfDay,
        exactTime: m.exactTime,
        doses: m.doses,
        instructions: m.instructions,
      })),
      appointments: appointments.map((a) => ({
        id: a.id,
        type: a.type,
        date: a.date?.toISOString() || null,
        dayOffset: a.dayOffset,
        exactTime: a.exactTime,
        notes: a.notes,
        fasting: a.fasting,
        critical: a.critical,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Error fetching plan:", error);
    return serverErrorResponse();
  }
}
