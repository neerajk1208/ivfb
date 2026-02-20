import { requireUser } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();

    return successResponse({
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      phoneE164: user.phoneE164,
      smsConsent: user.smsConsent,
      quietHours: user.quietHours,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Settings fetch error:", error);
    return serverErrorResponse();
  }
}
