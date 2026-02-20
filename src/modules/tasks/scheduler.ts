import { getDueTasks, markTaskSent } from "./taskService";
import { sendSms } from "@/modules/messaging/messagingService";
import { createChatMessage } from "@/modules/chat/chatService";
import type { MessageType } from "@/modules/chat/chatService";

export interface TickResult {
  processed: number;
  sent: number;
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

export async function runSchedulerTick(): Promise<TickResult> {
  const result: TickResult = {
    processed: 0,
    sent: 0,
    chatCreated: 0,
    failed: 0,
    errors: [],
  };

  try {
    const dueTasks = await getDueTasks();
    result.processed = dueTasks.length;

    for (const task of dueTasks) {
      const user = task.cycle.user;

      try {
        // Always create a chat message
        const chatContent = formatChatMessage(task);
        const messageType = getMessageTypeFromTaskKind(task.kind);

        await createChatMessage({
          userId: user.id,
          cycleId: task.cycleId,
          sender: "SYSTEM",
          type: messageType,
          content: chatContent,
          meta: task.meta,
        });
        result.chatCreated++;

        // Also send SMS if user has consent and phone
        if (user.phoneE164 && user.smsConsent) {
          const smsBody = formatSmsMessage(task);
          const smsResult = await sendSms({
            userId: user.id,
            toNumber: user.phoneE164,
            body: smsBody,
          });

          if (smsResult.success) {
            result.sent++;
          } else {
            // SMS failed but chat was created - don't count as full failure
            result.errors.push(`SMS for task ${task.id}: ${smsResult.error}`);
          }
        }

        // Mark task as sent (chat message was created)
        await markTaskSent(task.id);
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Task ${task.id}: ${error instanceof Error ? error.message : "Unknown error"}`
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
