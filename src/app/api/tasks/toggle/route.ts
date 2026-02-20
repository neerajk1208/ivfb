import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await parseJsonBody(request);
    if (!body || typeof (body as any).taskId !== "string") {
      return errorResponse("Invalid request body");
    }

    const { taskId, done } = body as { taskId: string; done: boolean };

    const cycle = await getActiveCycle(user.id);
    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task || task.cycleId !== cycle.id) {
      return notFoundResponse("Task");
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: done ? "DONE" : "PENDING" },
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Task toggle error:", error);
    return serverErrorResponse();
  }
}
