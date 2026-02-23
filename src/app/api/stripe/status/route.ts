import { requireUser } from "@/lib/auth";
import { getSubscriptionStatus } from "@/lib/stripe";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const status = await getSubscriptionStatus(user.id);

    return successResponse(status);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Status error:", error);
    return serverErrorResponse();
  }
}
