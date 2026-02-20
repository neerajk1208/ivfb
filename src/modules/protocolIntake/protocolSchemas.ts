import { z } from "zod";

export const confidenceLevelSchema = z.enum(["high", "medium", "low"]);

export const dosageUnitSchema = z.enum([
  "IU",      // International Units (Gonal-F, Menopur)
  "mg",      // Milligrams
  "mcg",     // Micrograms
  "mL",      // Milliliters
  "pills",   // Oral pills
  "patches", // Patches
  "units",   // Generic units
]);

export const frequencySchema = z.enum([
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "every_other_day",
  "as_needed",
  "single_dose",
]);

export const routeSchema = z.enum([
  "subcutaneous",  // Most IVF injections
  "intramuscular", // PIO, trigger
  "oral",          // Pills
  "vaginal",       // Suppositories
  "patch",         // Estrogen patches
  "nasal",         // Some medications
]);

export const appointmentTypeSchema = z.enum([
  "BLOODWORK",
  "ULTRASOUND",
  "MONITORING",    // Combined BW + US
  "TRIGGER",       // Trigger shot timing
  "RETRIEVAL",     // Egg retrieval
  "TRANSFER",      // Embryo transfer
  "CONSULTATION",
  "OTHER",
]);

export const medicationExtractionSchema = z.object({
  name: z.string(),
  dosageAmount: z.number().positive().nullable(),
  dosageUnit: z.string().nullable(),
  dosage: z.string().nullable(), // Fallback if can't parse amount/unit
  frequency: z.string().default("once_daily"),
  route: z.string().nullable(),
  startDayOffset: z.number().int().min(0),
  durationDays: z.number().int().min(1),
  timeOfDay: z
    .enum(["morning", "afternoon", "evening", "bedtime"])
    .nullable(),
  exactTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable(),
  instructions: z.string().nullable(),
});

export const appointmentExtractionSchema = z.object({
  type: appointmentTypeSchema,
  dayOffset: z.number().int().min(0),
  exactTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable(),
  notes: z.string().nullable(),
  fasting: z.boolean().default(false),
  critical: z.boolean().default(false), // True for trigger, retrieval, transfer
});

export const milestoneExtractionSchema = z.object({
  type: z.enum([
    "CYCLE_START",
    "STIM_START",
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
  appointments: confidenceLevelSchema,
});

export const protocolPlanExtractionSchema = z.object({
  cycleStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  medications: z.array(medicationExtractionSchema),
  appointments: z.array(appointmentExtractionSchema),
  milestones: z.array(milestoneExtractionSchema),
  notes: z.string().nullable(),
  confidence: confidenceSchema,
  missingFields: z.array(z.string()),
});

export type MedicationExtraction = z.infer<typeof medicationExtractionSchema>;
export type AppointmentExtraction = z.infer<typeof appointmentExtractionSchema>;
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
      description: "First date shown on calendar in YYYY-MM-DD format",
    },
    medications: {
      type: "array",
      description: "All medications with their schedules",
      items: {
        type: "object",
        properties: {
          name: { 
            type: "string",
            description: "Full medication name (e.g., 'Gonal-F', 'Menopur', 'Cetrotide')"
          },
          dosageAmount: { 
            type: ["number", "null"],
            description: "Numeric dosage amount (e.g., 225, 75, 0.25)"
          },
          dosageUnit: { 
            type: ["string", "null"],
            enum: ["IU", "mg", "mcg", "mL", "pills", "patches", "units", null],
            description: "Unit of measurement"
          },
          dosage: { 
            type: ["string", "null"],
            description: "Full dosage string as fallback (e.g., '225 IU')"
          },
          frequency: {
            type: "string",
            enum: ["once_daily", "twice_daily", "three_times_daily", "every_other_day", "as_needed", "single_dose"],
            default: "once_daily",
          },
          route: {
            type: ["string", "null"],
            enum: ["subcutaneous", "intramuscular", "oral", "vaginal", "patch", "nasal", null],
            description: "How medication is administered"
          },
          startDayOffset: { 
            type: "integer", 
            minimum: 0,
            description: "Day number when medication starts (0 = first day on calendar)"
          },
          durationDays: { 
            type: "integer", 
            minimum: 1,
            description: "Total number of days medication is taken"
          },
          timeOfDay: {
            type: ["string", "null"],
            enum: ["morning", "afternoon", "evening", "bedtime", null],
          },
          exactTime: {
            type: ["string", "null"],
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            description: "Exact time in HH:mm format (24-hour) if specified"
          },
          instructions: { 
            type: ["string", "null"],
            description: "Special instructions (e.g., 'take with food', 'rotate injection sites')"
          },
        },
        required: ["name", "startDayOffset", "durationDays"],
      },
    },
    appointments: {
      type: "array",
      description: "All scheduled appointments (bloodwork, ultrasound, procedures)",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["BLOODWORK", "ULTRASOUND", "MONITORING", "TRIGGER", "RETRIEVAL", "TRANSFER", "CONSULTATION", "OTHER"],
            description: "Type of appointment"
          },
          dayOffset: { 
            type: "integer", 
            minimum: 0,
            description: "Day number (0 = first day on calendar)"
          },
          exactTime: {
            type: ["string", "null"],
            pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$",
            description: "Scheduled time in HH:mm format"
          },
          notes: { type: ["string", "null"] },
          fasting: { 
            type: "boolean",
            default: false,
            description: "True if fasting required (common for AM bloodwork)"
          },
          critical: {
            type: "boolean",
            default: false,
            description: "True for time-sensitive appointments (trigger shot, retrieval, transfer)"
          },
        },
        required: ["type", "dayOffset"],
      },
    },
    milestones: {
      type: "array",
      description: "Key cycle milestones",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["CYCLE_START", "STIM_START", "TRIGGER", "RETRIEVAL", "TRANSFER", "PREG_TEST", "OTHER"],
          },
          dayOffset: { type: "integer", minimum: 0 },
          label: { type: ["string", "null"] },
          details: { type: ["string", "null"] },
        },
        required: ["type", "dayOffset"],
      },
    },
    notes: { 
      type: ["string", "null"],
      description: "Any additional notes or instructions from the document"
    },
    confidence: {
      type: "object",
      properties: {
        cycleStartDate: { type: "string", enum: ["high", "medium", "low"] },
        medications: { type: "string", enum: ["high", "medium", "low"] },
        appointments: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["cycleStartDate", "medications", "appointments"],
    },
    missingFields: {
      type: "array",
      items: { type: "string" },
      description: "List of fields that couldn't be determined"
    },
  },
  required: ["medications", "appointments", "confidence", "missingFields"],
};
