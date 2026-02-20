import { getDueTasks, markTaskSent } from "./taskService";
import { sendSms } from "@/modules/messaging/messagingService";

export interface TickResult {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

export async function runSchedulerTick(): Promise<TickResult> {
  const result: TickResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  };

  try {
    const dueTasks = await getDueTasks();
    result.processed = dueTasks.length;

    for (const task of dueTasks) {
      const user = task.cycle.user;

      if (!user.phoneE164 || !user.smsConsent) {
        continue;
      }

      try {
        let messageBody: string;

        if (task.kind === "REMINDER") {
          const meta = task.meta as any;
          messageBody = `💊 Reminder: ${task.label}`;
          if (meta?.instructions) {
            messageBody += `\n${meta.instructions}`;
          }
        } else if (task.kind === "CHECKIN") {
          messageBody = `💛 Quick check-in: How are you feeling today? Reply with a number 1-5 (1=rough, 5=great) and any notes.`;
        } else {
          messageBody = `📋 ${task.label}`;
        }

        const smsResult = await sendSms({
          userId: user.id,
          toNumber: user.phoneE164,
          body: messageBody,
        });

        if (smsResult.success) {
          await markTaskSent(task.id);
          result.sent++;
        } else {
          result.failed++;
          result.errors.push(`Task ${task.id}: ${smsResult.error}`);
        }
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
