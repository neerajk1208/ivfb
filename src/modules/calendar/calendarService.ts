import { prisma } from "@/lib/db";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function getCalendarAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calendarAccessToken: true,
      calendarRefreshToken: true,
    },
  });

  if (!user?.calendarRefreshToken) {
    return null;
  }

  try {
    const newAccessToken = await refreshAccessToken(user.calendarRefreshToken);
    
    await prisma.user.update({
      where: { id: userId },
      data: { calendarAccessToken: newAccessToken },
    });

    return newAccessToken;
  } catch {
    return null;
  }
}

export async function saveCalendarTokens(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      calendarAccessToken: accessToken,
      calendarRefreshToken: refreshToken,
      calendarConnectedAt: new Date(),
    },
  });
}

export async function disconnectCalendar(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      calendarAccessToken: null,
      calendarRefreshToken: null,
      calendarConnectedAt: null,
    },
  });
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarRefreshToken: true },
  });
  return !!user?.calendarRefreshToken;
}

interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent
): Promise<{ id: string } | null> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    console.error("Failed to create calendar event:", await response.text());
    return null;
  }

  return response.json();
}

export async function syncAppointmentsToCalendar(
  userId: string,
  cycleId: string
): Promise<{ synced: number; failed: number }> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error("Calendar not connected");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  const protocol = await prisma.protocolPlan.findFirst({
    where: { cycleId, status: "ACTIVE" },
    include: { appointments: true },
  });

  if (!protocol) {
    throw new Error("No active protocol found");
  }

  const result = { synced: 0, failed: 0 };

  for (const apt of protocol.appointments) {
    const aptDate = new Date(protocol.cycleStartDate);
    aptDate.setDate(aptDate.getDate() + apt.dayOffset);

    let startHour = 9;
    let startMinute = 0;
    if (apt.exactTime) {
      const [h, m] = apt.exactTime.split(":").map(Number);
      startHour = h;
      startMinute = m;
    }

    const startDateTime = new Date(aptDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(startDateTime.getHours() + 1);

    const typeLabels: Record<string, string> = {
      BLOODWORK: "Bloodwork",
      ULTRASOUND: "Ultrasound",
      MONITORING: "Monitoring",
      TRIGGER: "Trigger Shot",
      RETRIEVAL: "Egg Retrieval",
      TRANSFER: "Embryo Transfer",
    };

    const summary = `IVF: ${typeLabels[apt.type] || apt.type}`;
    let description = "";
    if (apt.fasting) {
      description += "⚠️ Fasting required\n";
    }
    if (apt.notes) {
      description += apt.notes;
    }

    const event: CalendarEvent = {
      summary,
      description: description || undefined,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: user?.timezone || "America/Los_Angeles",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: user?.timezone || "America/Los_Angeles",
      },
    };

    const created = await createCalendarEvent(accessToken, event);
    if (created) {
      result.synced++;
    } else {
      result.failed++;
    }
  }

  return result;
}
