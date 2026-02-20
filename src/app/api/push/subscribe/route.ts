import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await parseJsonBody(request) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    } | null;

    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return errorResponse("Invalid subscription data");
    }

    const existingSub = await prisma.pushSubscription.findUnique({
      where: { endpoint: body.endpoint },
    });

    if (existingSub) {
      if (existingSub.userId !== user.id) {
        await prisma.pushSubscription.update({
          where: { id: existingSub.id },
          data: { userId: user.id },
        });
      }
      return successResponse({ subscribed: true });
    }

    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });

    return successResponse({ subscribed: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Push subscribe error:", error);
    return serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await parseJsonBody(request) as { endpoint?: string } | null;

    if (!body?.endpoint) {
      return errorResponse("Endpoint is required");
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint: body.endpoint,
      },
    });

    return successResponse({ unsubscribed: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Push unsubscribe error:", error);
    return serverErrorResponse();
  }
}
