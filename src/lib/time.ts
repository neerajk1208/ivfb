import { format, parseISO, addDays, differenceInDays, setHours, setMinutes } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export const DEFAULT_TIMES = {
  morning: { hour: 9, minute: 0 },
  afternoon: { hour: 13, minute: 0 },
  evening: { hour: 20, minute: 30 },
  bedtime: { hour: 22, minute: 0 },
  checkin: { hour: 19, minute: 0 },
} as const;

export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour, minute };
}

export function formatTimeString(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function getLocalDateInTimezone(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

export function toUTC(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone);
}

export function formatDateForUser(date: Date, timezone: string, formatStr: string = "MMM d, yyyy"): string {
  return formatInTimeZone(date, timezone, formatStr);
}

export function getCycleDayIndex(cycleStartDate: Date, currentDate: Date): number {
  return differenceInDays(currentDate, cycleStartDate);
}

export function getDateForDayOffset(cycleStartDate: Date, dayOffset: number): Date {
  return addDays(cycleStartDate, dayOffset);
}

export function createDueAtTime(
  date: Date,
  timeOfDay: string | null,
  customTime: string | null,
  timezone: string
): Date {
  const localDate = toZonedTime(date, timezone);
  let time: { hour: number; minute: number } = { ...DEFAULT_TIMES.morning };

  if (customTime) {
    time = parseTimeString(customTime);
  } else if (timeOfDay && timeOfDay in DEFAULT_TIMES) {
    const defaultTime = DEFAULT_TIMES[timeOfDay as keyof typeof DEFAULT_TIMES];
    time = { hour: defaultTime.hour, minute: defaultTime.minute };
  }

  const localDateTime = setMinutes(setHours(localDate, time.hour), time.minute);
  return fromZonedTime(localDateTime, timezone);
}

export function isWithinQuietHours(
  time: Date,
  quietHours: { start: string; end: string } | null,
  timezone: string
): boolean {
  if (!quietHours) return false;

  const localTime = toZonedTime(time, timezone);
  const hour = localTime.getHours();
  const minute = localTime.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const start = parseTimeString(quietHours.start);
  const end = parseTimeString(quietHours.end);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function pushOutOfQuietHours(
  time: Date,
  quietHours: { start: string; end: string } | null,
  timezone: string
): Date {
  if (!quietHours || !isWithinQuietHours(time, quietHours, timezone)) {
    return time;
  }

  const end = parseTimeString(quietHours.end);
  const localDate = toZonedTime(time, timezone);
  const adjustedLocal = setMinutes(setHours(localDate, end.hour), end.minute);
  
  return fromZonedTime(adjustedLocal, timezone);
}

export function getTodayInTimezone(timezone: string): Date {
  const now = new Date();
  const local = toZonedTime(now, timezone);
  local.setHours(0, 0, 0, 0);
  return local;
}

export function formatRelativeDay(date: Date, timezone: string): string {
  const today = getTodayInTimezone(timezone);
  const targetDate = toZonedTime(date, timezone);
  targetDate.setHours(0, 0, 0, 0);
  
  const diff = differenceInDays(targetDate, today);
  
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  
  return formatInTimeZone(date, timezone, "EEEE, MMM d");
}
