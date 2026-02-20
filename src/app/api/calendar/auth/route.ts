import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/http";
import { getCalendarAuthUrl } from "@/modules/calendar/calendarService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    
    const { searchParams } = new URL(request.url);
    const returnTo = searchParams.get("returnTo") || "/settings";
    
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/calendar/callback`;
    
    const state = Buffer.from(
      JSON.stringify({ userId: user.id, returnTo })
    ).toString("base64");

    const authUrl = getCalendarAuthUrl(redirectUri, state);
    
    return Response.redirect(authUrl);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    return Response.redirect("/settings?error=calendar_auth_failed");
  }
}
