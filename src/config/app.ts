export const appConfig = {
  defaultTimezone: "America/Los_Angeles",
  
  reminderTimes: {
    morning: "09:00",
    afternoon: "13:00",
    evening: "20:30",
    bedtime: "22:00",
  },
  
  checkinTime: "19:00",
  
  defaultQuietHours: {
    start: "21:00",
    end: "08:00",
  },
  
  planDaysAhead: 14,
  
  sms: {
    maxLength: 320,
  },
  
  conversationSummaryMaxLength: 1200,
  
  disclaimers: {
    general: "IVF Buddy is for informational support only and is not medical advice. Always follow your clinic's instructions.",
    checkin: "Remember: This is not medical advice. Contact your clinic with any medical concerns.",
  },
} as const;

export type AppConfig = typeof appConfig;
