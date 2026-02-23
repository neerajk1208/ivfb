import { requireUser } from "@/lib/auth";
import { createPortalSession } from "@/lib/stripe";
import { successResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/http";

export async function POST() {
  try {
    const user = await requireUser();
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const returnUrl = `${baseUrl}/settings`;

    const portalUrl = await createPortalSession(user.id, returnUrl);

    return successResponse({ url: portalUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message === "No Stripe customer found") {
      return errorResponse("No billing account found");
    }
    console.error("Portal error:", error);
    return serverErrorResponse();
  }
}
