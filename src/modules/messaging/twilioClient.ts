import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

export function getTwilioClient() {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }
  return twilio(accountSid, authToken);
}

export function getTwilioPhoneNumber(): string {
  if (!phoneNumber) {
    throw new Error("Twilio phone number not configured");
  }
  return phoneNumber;
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) {
    console.warn("Twilio auth token not configured, skipping validation");
    return true;
  }
  return twilio.validateRequest(authToken, signature, url, params);
}
