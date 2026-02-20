import { z } from "zod";

export const confidenceLevelSchema = z.enum(["high", "medium", "low"]);

export const medicationExtractionSchema = z.object({
  name: z.string(),
  dosage: z.string().nullable(),
  startDayOffset: z.number().int().min(0),
  durationDays: z.number().int().min(1),
  timeOfDay: z
    .enum(["morning", "afternoon", "evening", "bedtime", "custom"])
    .nullable(),
  customTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable(),
  instructions: z.string().nullable(),
});

export const milestoneExtractionSchema = z.object({
  type: z.enum([
    "MONITORING",
    "TRIGGER",
    "RETRIEVAL",
    "TRANSFER",
    "PREG_TEST",
    "OTHER",
  ]),
  dayOffset: z.number().int().min(0),
  label: z.string().nullable(),
  details: z.string().nullable(),
});

export const confidenceSchema = z.object({
  cycleStartDate: confidenceLevelSchema,
  medications: confidenceLevelSchema,
  milestones: confidenceLevelSchema,
});

export const protocolPlanExtractionSchema = z.object({
  cycleStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  medications: z.array(medicationExtractionSchema),
  milestones: z.array(milestoneExtractionSchema),
  notes: z.string().nullable(),
  confidence: confidenceSchema,
  missingFields: z.array(z.string()),
});

export type MedicationExtraction = z.infer<typeof medicationExtractionSchema>;
export type MilestoneExtraction = z.infer<typeof milestoneExtractionSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type ProtocolPlanExtraction = z.infer<typeof protocolPlanExtractionSchema>;

export const protocolPlanExtractionJsonSchema = {
  type: "object",
  properties: {
    cycleStartDate: {
      type: ["string", "null"],
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
      description: "Cycle start date in YYYY-MM-DD format, or null if not found",
    },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          dosage: { type: ["string", "null"] },
          startDayOffset: { type: "integer", minimum: 0 },
          durationDays: { type: "integer", minimum: 1 },
          timeOfDay: {
            type: ["string", "null"],
            enum: ["morning", "afternoon", "evening", "bedtime", "custom", null],
          },
          customTime: {
            type: ["string", "null"],
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
          },
          instructions: { type: ["string", "null"] },
        },
        required: ["name", "startDayOffset", "durationDays"],
      },
    },
    milestones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["MONITORING", "TRIGGER", "RETRIEVAL", "TRANSFER", "PREG_TEST", "OTHER"],
          },
          dayOffset: { type: "integer", minimum: 0 },
          label: { type: ["string", "null"] },
          details: { type: ["string", "null"] },
        },
        required: ["type", "dayOffset"],
      },
    },
    notes: { type: ["string", "null"] },
    confidence: {
      type: "object",
      properties: {
        cycleStartDate: { type: "string", enum: ["high", "medium", "low"] },
        medications: { type: "string", enum: ["high", "medium", "low"] },
        milestones: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["cycleStartDate", "medications", "milestones"],
    },
    missingFields: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["medications", "milestones", "confidence", "missingFields"],
};
