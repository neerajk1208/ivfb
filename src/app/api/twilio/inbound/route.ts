import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { validateTwilioSignature } from "@/modules/messaging/twilioClient";
import { logInboundMessage, sendSms } from "@/modules/messaging/messagingService";
import { parseInboundMessage } from "@/modules/messaging/inboundParser";
import { createCheckIn } from "@/modules/checkins/checkinService";
import { generateBuddyReply } from "@/modules/buddy/buddyService";
import { getOptOutConfirmation } from "@/modules/buddy/fallbackRules";
import { updateSmsConsent } from "@/modules/user/userService";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    const headersList = await headers();
    const signature = headersList.get("x-twilio-signature") || "";
    const url = `${process.env.APP_BASE_URL}/api/twilio/inbound`;

    if (process.env.NODE_ENV === "production") {
      const isValid = validateTwilioSignature(signature, url, params);
      if (!isValid) {
        console.warn("Invalid Twilio signature");
        return new Response("Invalid signature", { status: 403 });
      }
    }

    const fromNumber = params.From;
    const body = params.Body || "";
    const messageSid = params.MessageSid;

    if (!fromNumber) {
      return new Response("Missing From number", { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { phoneE164: fromNumber },
      include: {
        cycles: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      console.warn(`Unknown phone number: ${fromNumber}`);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    await logInboundMessage(user.id, fromNumber, body, messageSid);

    const parsed = parseInboundMessage(body);

    if (parsed.isOptOut) {
      await updateSmsConsent(user.id, false);
      await sendSms({
        userId: user.id,
        toNumber: fromNumber,
        body: getOptOutConfirmation(),
      });

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const activeCycle = user.cycles[0];
    if (!activeCycle) {
      await sendSms({
        userId: user.id,
        toNumber: fromNumber,
        body: "Hi! Please complete your profile in the IVF Buddy app first 💛",
      });

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    await createCheckIn(user.id, {
      cycleId: activeCycle.id,
      mood: parsed.mood,
      symptoms: parsed.symptoms,
      note: parsed.note || null,
      source: "SMS",
    });

    const buddyReply = await generateBuddyReply({
      userId: user.id,
      cycleId: activeCycle.id,
      userMessage: body,
      mood: parsed.mood,
      symptoms: parsed.symptoms,
      userTimezone: user.timezone,
    });

    await sendSms({
      userId: user.id,
      toNumber: fromNumber,
      body: buddyReply.messageText,
    });

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("Twilio inbound error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
