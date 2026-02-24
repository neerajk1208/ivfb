import { getDueTasks, markTaskSent } from "./taskService";
import { sendSms } from "@/modules/messaging/messagingService";
import { createChatMessage } from "@/modules/chat/chatService";
import { sendPushToUser } from "@/modules/push/pushService";
import { hasActiveSubscription } from "@/lib/stripe";
import type { MessageType } from "@/modules/chat/chatService";

export interface TickResult {
  processed: number;
  skippedNoSub: number;
  smsSent: number;
  pushSent: number;
  chatCreated: number;
  failed: number;
  errors: string[];
}

function getMessageTypeFromTaskKind(kind: string): MessageType {
  switch (kind) {
    case "REMINDER":
      return "REMINDER";
    case "CHECKIN":
      return "CHECKIN";
    case "APPOINTMENT":
    case "CRITICAL":
      return "APPOINTMENT";
    default:
      return "INFO";
  }
}

function formatChatMessage(task: any): string {
  const meta = task.meta as any;

  if (task.kind === "REMINDER") {
    let msg = `💊 Time for your medication: ${task.label}`;
    if (meta?.instructions) {
      msg += `\n\n${meta.instructions}`;
    }
    msg += `\n\nReply "done" when complete, or let me know how you're feeling.`;
    return msg;
  }

  if (task.kind === "CHECKIN") {
    return `💛 Daily check-in time! How are you feeling today?\n\nReply with a number 1-5 (1=rough, 5=great) and share any symptoms or notes.`;
  }

  if (task.kind === "PROACTIVE_CHECKIN") {
    return `💛 ${task.label}\n\nHow are you feeling? Reply with your mood (1-5) or just share what's on your mind.`;
  }

  if (task.kind === "APPOINTMENT" || task.kind === "CRITICAL") {
    let msg = `📅 ${task.label}`;
    if (meta?.exactTime) {
      msg += ` at ${meta.exactTime}`;
    }
    if (meta?.fasting) {
      msg += `\n\n⚠️ Remember to fast!`;
    }
    if (meta?.notes) {
      msg += `\n\n${meta.notes}`;
    }
    return msg;
  }

  return `📋 ${task.label}`;
}

function formatSmsMessage(task: any): string {
  const meta = task.meta as any;

  if (task.kind === "REMINDER") {
    let msg = `💊 Reminder: ${task.label}`;
    if (meta?.instructions) {
      msg += `\n${meta.instructions}`;
    }
    return msg;
  }

  if (task.kind === "CHECKIN") {
    return `💛 Check-in: How are you feeling? Reply 1-5 (1=rough, 5=great) and any notes.`;
  }

  if (task.kind === "APPOINTMENT" || task.kind === "CRITICAL") {
    let msg = `📅 ${task.label}`;
    if (meta?.fasting) {
      msg += ` (fasting required)`;
    }
    return msg;
  }

  return `📋 ${task.label}`;
}

function formatPushNotification(task: any): { title: string; body: string; tag: string } {
  const meta = task.meta as any;

  if (task.kind === "REMINDER") {
    return {
      title: "💊 Medication Reminder",
      body: task.label,
      tag: `reminder-${task.id}`,
    };
  }

  if (task.kind === "CHECKIN") {
    return {
      title: "💛 Check-in Time",
      body: "How are you feeling today? Tap to log your mood.",
      tag: `checkin-${task.id}`,
    };
  }

  if (task.kind === "PROACTIVE_CHECKIN") {
    return {
      title: "💛 Checking In",
      body: task.label.slice(0, 100),
      tag: `proactive-${task.id}`,
    };
  }

  if (task.kind === "APPOINTMENT" || task.kind === "CRITICAL") {
    let body = task.label;
    if (meta?.fasting) {
      body += " (fasting required)";
    }
    return {
      title: "📅 Appointment Reminder",
      body,
      tag: `appointment-${task.id}`,
    };
  }

  return {
    title: "IVF Buddy",
    body: task.label,
    tag: `task-${task.id}`,
  };
}

function formatBundledChatMessage(tasks: any[]): string {
  const reminders = tasks.filter((t) => t.kind === "REMINDER");
  const appointments = tasks.filter((t) => t.kind === "APPOINTMENT" || t.kind === "CRITICAL");
  const checkins = tasks.filter((t) => t.kind === "CHECKIN");
  const other = tasks.filter((t) => !["REMINDER", "APPOINTMENT", "CRITICAL", "CHECKIN"].includes(t.kind));

  const parts: string[] = [];

  if (reminders.length > 0) {
    if (reminders.length === 1) {
      const meta = reminders[0].meta as any;
      let msg = `💊 Time for your medication: ${reminders[0].label}`;
      if (meta?.instructions) {
        msg += `\n${meta.instructions}`;
      }
      parts.push(msg);
    } else {
      const medList = reminders.map((t) => `• ${t.label}`).join("\n");
      parts.push(`💊 Time for your medications:\n${medList}`);
    }
  }

  for (const apt of appointments) {
    const meta = apt.meta as any;
    let msg = `📅 ${apt.label}`;
    if (meta?.exactTime) msg += ` at ${meta.exactTime}`;
    if (meta?.fasting) msg += `\n⚠️ Remember to fast!`;
    if (meta?.notes) msg += `\n${meta.notes}`;
    parts.push(msg);
  }

  for (const checkin of checkins) {
    parts.push(`💛 Daily check-in time! How are you feeling today?\nReply with a number 1-5 (1=rough, 5=great).`);
  }

  for (const item of other) {
    parts.push(`📋 ${item.label}`);
  }

  let final = parts.join("\n\n");
  if (reminders.length > 0) {
    final += `\n\nReply "done" when complete, or let me know how you're feeling.`;
  }
  return final;
}

function formatBundledSms(tasks: any[]): string {
  const reminders = tasks.filter((t) => t.kind === "REMINDER");
  const appointments = tasks.filter((t) => t.kind === "APPOINTMENT" || t.kind === "CRITICAL");
  const checkins = tasks.filter((t) => t.kind === "CHECKIN");

  const parts: string[] = [];

  if (reminders.length > 0) {
    if (reminders.length === 1) {
      parts.push(`💊 ${reminders[0].label}`);
    } else {
      const names = reminders.map((t) => t.label.split(" ")[0]).join(", ");
      parts.push(`💊 Meds: ${names}`);
    }
  }

  for (const apt of appointments) {
    const meta = apt.meta as any;
    let msg = `📅 ${apt.label}`;
    if (meta?.fasting) msg += " (fast)";
    parts.push(msg);
  }

  if (checkins.length > 0) {
    parts.push(`💛 Check-in: Reply 1-5`);
  }

  return parts.join(" | ");
}

function formatBundledPush(tasks: any[]): { title: string; body: string; tag: string } {
  const reminders = tasks.filter((t) => t.kind === "REMINDER");
  const appointments = tasks.filter((t) => t.kind === "APPOINTMENT" || t.kind === "CRITICAL");
  const checkins = tasks.filter((t) => t.kind === "CHECKIN");

  if (reminders.length > 0 && appointments.length === 0 && checkins.length === 0) {
    if (reminders.length === 1) {
      return {
        title: "💊 Medication Reminder",
        body: reminders[0].label,
        tag: `reminder-${reminders[0].id}`,
      };
    }
    return {
      title: "💊 Medication Reminder",
      body: `${reminders.length} medications due now`,
      tag: `reminder-bundle-${Date.now()}`,
    };
  }

  if (appointments.length > 0 && reminders.length === 0 && checkins.length === 0) {
    const meta = appointments[0].meta as any;
    let body = appointments[0].label;
    if (meta?.fasting) body += " (fasting required)";
    return {
      title: "📅 Appointment Reminder",
      body,
      tag: `appointment-${appointments[0].id}`,
    };
  }

  if (checkins.length > 0 && reminders.length === 0 && appointments.length === 0) {
    return {
      title: "💛 Check-in Time",
      body: "How are you feeling today?",
      tag: `checkin-${checkins[0].id}`,
    };
  }

  return {
    title: "IVF Buddy",
    body: `${tasks.length} reminders`,
    tag: `bundle-${Date.now()}`,
  };
}

export async function runSchedulerTick(): Promise<TickResult> {
  const result: TickResult = {
    processed: 0,
    skippedNoSub: 0,
    smsSent: 0,
    pushSent: 0,
    chatCreated: 0,
    failed: 0,
    errors: [],
  };

  try {
    const dueTasks = await getDueTasks();
    result.processed = dueTasks.length;

    const tasksByUserTime: Map<string, any[]> = new Map();
    for (const task of dueTasks) {
      if (!task.dueAt) continue;
      const dueTime = new Date(task.dueAt);
      dueTime.setSeconds(0, 0);
      const key = `${task.cycle.user.id}-${dueTime.toISOString()}`;
      const existing = tasksByUserTime.get(key);
      if (existing) {
        existing.push(task);
      } else {
        tasksByUserTime.set(key, [task]);
      }
    }

    for (const tasks of tasksByUserTime.values()) {
      const user = tasks[0].cycle.user;
      const cycleId = tasks[0].cycleId;

      const isSubscribed = await hasActiveSubscription(user.id);
      if (!isSubscribed) {
        result.skippedNoSub += tasks.length;
        for (const task of tasks) {
          await markTaskSent(task.id);
        }
        continue;
      }

      try {
        const chatContent = formatBundledChatMessage(tasks);
        const hasReminders = tasks.some((t) => t.kind === "REMINDER");
        const hasAppointments = tasks.some((t) => t.kind === "APPOINTMENT" || t.kind === "CRITICAL");
        const messageType: MessageType = hasAppointments ? "APPOINTMENT" : hasReminders ? "REMINDER" : "INFO";

        await createChatMessage({
          userId: user.id,
          cycleId,
          sender: "SYSTEM",
          type: messageType,
          content: chatContent,
          meta: tasks.length === 1 ? tasks[0].meta : { taskCount: tasks.length },
        });
        result.chatCreated++;

        const pushPayload = formatBundledPush(tasks);
        const pushResult = await sendPushToUser(user.id, {
          ...pushPayload,
          url: "/chat",
        });
        result.pushSent += pushResult.sent;
        if (pushResult.errors.length > 0) {
          result.errors.push(...pushResult.errors.map((e) => `Push: ${e}`));
        }

        if (user.phoneE164 && user.smsConsent) {
          const smsBody = formatBundledSms(tasks);
          const smsResult = await sendSms({
            userId: user.id,
            toNumber: user.phoneE164,
            body: smsBody,
          });

          if (smsResult.success) {
            result.smsSent++;
          } else {
            result.errors.push(`SMS: ${smsResult.error}`);
          }
        }

        for (const task of tasks) {
          await markTaskSent(task.id);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Bundle error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Scheduler error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}
