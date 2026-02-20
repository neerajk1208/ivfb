import { z } from "zod";

export const phoneE164Schema = z.string().regex(
  /^\+[1-9]\d{1,14}$/,
  "Phone number must be in E.164 format (e.g., +12025551234)"
);

export const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  "Invalid timezone"
);

export const quietHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format"),
}).nullable();

export const profileUpdateSchema = z.object({
  timezone: timezoneSchema.optional(),
  phoneE164: phoneE164Schema.nullable().optional(),
  smsConsent: z.boolean().optional(),
  quietHours: quietHoursSchema.optional(),
});

export const uploadCreateSchema = z.object({
  kind: z.enum(["PDF", "IMAGE"]),
  mimeType: z.string(),
  cycleId: z.string().optional(),
});

export const uploadFinalizeSchema = z.object({
  uploadId: z.string(),
});

export const medicationInputSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dosage: z.string().nullable().optional(),
  startDayOffset: z.number().int().min(0),
  durationDays: z.number().int().min(1),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "bedtime", "custom"]).nullable().optional(),
  customTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
  instructions: z.string().nullable().optional(),
});

export const milestoneInputSchema = z.object({
  type: z.enum(["MONITORING", "TRIGGER", "RETRIEVAL", "TRANSFER", "PREG_TEST", "OTHER"]),
  dayOffset: z.number().int().min(0),
  label: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
});

export const intakeFormSchema = z.object({
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  medications: z.array(medicationInputSchema).min(1, "At least one medication is required"),
  milestones: z.array(milestoneInputSchema).optional(),
  notes: z.string().nullable().optional(),
});

export const protocolSaveSchema = z.object({
  cycleId: z.string(),
  protocolPlanId: z.string().optional(),
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  medications: z.array(medicationInputSchema),
  milestones: z.array(milestoneInputSchema).optional(),
  notes: z.string().nullable().optional(),
});

export const checkInCreateSchema = z.object({
  cycleId: z.string(),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  symptoms: z.array(z.string()).optional(),
  note: z.string().nullable().optional(),
  source: z.enum(["SMS", "APP"]).optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type MedicationInput = z.infer<typeof medicationInputSchema>;
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;
export type IntakeFormData = z.infer<typeof intakeFormSchema>;
export type ProtocolSaveData = z.infer<typeof protocolSaveSchema>;
export type CheckInCreate = z.infer<typeof checkInCreateSchema>;
