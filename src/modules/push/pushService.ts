import webpush from "web-push";
import { prisma } from "@/lib/db";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const APP_URL = process.env.APP_BASE_URL || "http://localhost:3000";

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;
  
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured - push notifications disabled");
    return false;
  }

  try {
    webpush.setVapidDetails(
      `mailto:support@ivfbuddy.app`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
    return true;
  } catch (error) {
    console.error("Failed to configure VAPID:", error);
    return false;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!configureVapid()) {
    return { sent: 0, failed: 0, errors: ["VAPID not configured"] };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const result = { sent: 0, failed: 0, errors: [] as string[] };

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );
      result.sent++;
    } catch (error: any) {
      result.failed++;

      if (error.statusCode === 404 || error.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: sub.id },
        }).catch(() => {});
        result.errors.push(`Subscription ${sub.id} expired, removed`);
      } else {
        result.errors.push(
          `Subscription ${sub.id}: ${error.message || "Unknown error"}`
        );
      }
    }
  }

  return result;
}

export async function sendPushToAllUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendPushToUser(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed };
}
