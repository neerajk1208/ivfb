import { prisma } from "@/lib/db";
import { getTwilioClient, getTwilioPhoneNumber } from "./twilioClient";
import { appConfig } from "@/config/app";

interface SendSmsInput {
  userId: string;
  toNumber: string;
  body: string;
}

interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const { userId, toNumber, body } = input;

  const truncatedBody = body.slice(0, appConfig.sms.maxLength);

  try {
    const client = getTwilioClient();
    const fromNumber = getTwilioPhoneNumber();

    const message = await client.messages.create({
      to: toNumber,
      from: fromNumber,
      body: truncatedBody,
    });

    await prisma.messageLog.create({
      data: {
        userId,
        direction: "OUTBOUND",
        channel: "SMS",
        toNumber,
        fromNumber,
        body: truncatedBody,
        providerMessageId: message.sid,
      },
    });

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error) {
    console.error("Failed to send SMS:", error);

    await prisma.messageLog.create({
      data: {
        userId,
        direction: "OUTBOUND",
        channel: "SMS",
        toNumber,
        fromNumber: getTwilioPhoneNumber(),
        body: `[FAILED] ${truncatedBody}`,
        providerMessageId: null,
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function logInboundMessage(
  userId: string,
  fromNumber: string,
  body: string,
  providerMessageId?: string
): Promise<void> {
  await prisma.messageLog.create({
    data: {
      userId,
      direction: "INBOUND",
      channel: "SMS",
      toNumber: getTwilioPhoneNumber(),
      fromNumber,
      body,
      providerMessageId: providerMessageId || null,
    },
  });
}
