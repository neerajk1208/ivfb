import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { successResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    
    const body = await request.json().catch(() => ({}));
    const returnTo = body.returnTo || "/onboarding/review";
    const returnUrl = `${baseUrl}${returnTo}`;

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
