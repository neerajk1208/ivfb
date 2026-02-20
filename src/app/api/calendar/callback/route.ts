import { NextRequest } from "next/server";
import {
  exchangeCodeForTokens,
  saveCalendarTokens,
} from "@/modules/calendar/calendarService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  if (error) {
    return Response.redirect(`${baseUrl}/settings?error=calendar_denied`);
  }

  if (!code || !stateParam) {
    return Response.redirect(`${baseUrl}/settings?error=calendar_invalid`);
  }

  let state: { userId: string; returnTo: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64").toString());
  } catch {
    return Response.redirect(`${baseUrl}/settings?error=calendar_invalid_state`);
  }

  try {
    const redirectUri = `${baseUrl}/api/calendar/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    await saveCalendarTokens(state.userId, tokens.accessToken, tokens.refreshToken);

    const returnUrl = state.returnTo || "/settings";
    return Response.redirect(`${baseUrl}${returnUrl}?calendar=connected`);
  } catch (err) {
    console.error("Calendar callback error:", err);
    return Response.redirect(`${baseUrl}/settings?error=calendar_token_failed`);
  }
}
