import { requireUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/http";

export async function POST() {
  try {
    const user = await requireUser();
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const returnUrl = `${baseUrl}/onboarding/review`;

    const checkoutUrl = await createCheckoutSession(user.id, user.email, returnUrl);

    return successResponse({ url: checkoutUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Checkout error:", error);
    return serverErrorResponse();
  }
}
