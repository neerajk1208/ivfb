import { z } from "zod";

export const buddyReplySchema = z.object({
  tier: z.number().int().min(0).max(3),
  category: z.enum(["normal", "positive", "elevated", "mental_health", "medical", "crisis"]),
  messageText: z.string().max(500), // Slightly higher limit, we'll filter down
  tags: z.array(z.string()),
  escalation: z.boolean(),
});

export type BuddyReply = z.infer<typeof buddyReplySchema>;

export const buddyReplyJsonSchema = {
  type: "object",
  properties: {
    tier: {
      type: "integer",
      minimum: 0,
      maximum: 3,
      description: "Emotional safety tier: 0=normal/positive, 1=elevated distress, 2=mental health or medical risk, 3=crisis",
    },
    category: {
      type: "string",
      enum: ["normal", "positive", "elevated", "mental_health", "medical", "crisis"],
      description: "Category of the emotional state",
    },
    messageText: {
      type: "string",
      maxLength: 500,
      description: "The response message",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Relevant tags for the response",
    },
    escalation: {
      type: "boolean",
      description: "Whether this requires escalation to clinic",
    },
  },
  required: ["tier", "category", "messageText", "tags", "escalation"],
};
