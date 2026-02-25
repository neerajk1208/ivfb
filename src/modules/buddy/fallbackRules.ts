import type { BuddyReply } from "./buddySchemas";

export function getFallbackReply(mood: number | null): BuddyReply {
  if (mood !== null) {
    if (mood <= 2) {
      return {
        tier: 0,
        category: "normal",
        messageText:
          "Hey 💛 I'm here. That sounds like a heavy day. Want one tiny grounding tip or just a little encouragement?",
        tags: ["low-mood", "supportive"],
        escalation: false,
      };
    }
    if (mood === 3) {
      return {
        tier: 0,
        category: "normal",
        messageText:
          "Thanks for checking in 💛 Middle-of-the-road days happen. Just keep doing what you're doing - you're making progress.",
        tags: ["neutral", "encouraging"],
        escalation: false,
      };
    }
    return {
      tier: 0,
      category: "positive",
      messageText:
        "Love to hear that 💛 Want to keep the momentum with a quick hydration + rest reminder?",
      tags: ["positive", "encouraging"],
      escalation: false,
    };
  }

  return {
    tier: 0,
    category: "normal",
    messageText:
      "Thanks for reaching out 💛 I'm here if you need anything. How are you feeling today on a scale of 1-5?",
    tags: ["general", "check-in"],
    escalation: false,
  };
}

export function getOptOutConfirmation(): string {
  return "You've been unsubscribed from IVF Buddy SMS. You can re-enable notifications anytime in the app. Take care 💛";
}
