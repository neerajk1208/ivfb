import { z } from "zod";

export const buddyReplySchema = z.object({
  messageText: z.string().max(320),
  tags: z.array(z.string()),
  escalation: z.boolean(),
});

export type BuddyReply = z.infer<typeof buddyReplySchema>;

export const buddyReplyJsonSchema = {
  type: "object",
  properties: {
    messageText: {
      type: "string",
      maxLength: 320,
      description: "The response message, max 320 characters",
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
  required: ["messageText", "tags", "escalation"],
};
