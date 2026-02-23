import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/http";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "ivf-admin-secret";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await request.json();
    const { email, freeAccess } = body;

    if (!email) {
      return errorResponse("Email is required");
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse("User not found");
    }

    await prisma.user.update({
      where: { email },
      data: { freeAccess: freeAccess !== false },
    });

    return successResponse({
      message: `Free access ${freeAccess !== false ? "granted" : "revoked"} for ${email}`,
    });
  } catch (error) {
    console.error("Free access error:", error);
    return serverErrorResponse();
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return errorResponse("Unauthorized", 401);
    }

    const freeUsers = await prisma.user.findMany({
      where: { freeAccess: true },
      select: { email: true, name: true, createdAt: true },
    });

    return successResponse({ users: freeUsers });
  } catch (error) {
    console.error("Free access list error:", error);
    return serverErrorResponse();
  }
}
