/**
 * Safety Audit Logging Service
 * 
 * Logs all Tier 2+ safety events for:
 * - Liability protection
 * - Quality improvement
 * - Clinical partnership requirements
 */

import { prisma } from "@/lib/db";
import type { SafetyClassification } from "@/config/buddy/safetyTiers";

export interface SafetyAuditEvent {
  userId: string;
  cycleId?: string;
  classification: SafetyClassification;
  userMessage: string;
  responseText: string;
}

/**
 * Log a safety event to the audit table.
 * Only logs Tier 2+ events to avoid noise.
 */
export async function logSafetyEvent(event: SafetyAuditEvent): Promise<void> {
  // Only log Tier 2+ events
  if (event.classification.tier < 2) {
    return;
  }

  try {
    await prisma.safetyAuditLog.create({
      data: {
        userId: event.userId,
        cycleId: event.cycleId,
        tier: event.classification.tier,
        category: event.classification.category,
        triggerPhrase: event.classification.triggerPhrase,
        source: event.classification.source,
        userMessage: event.userMessage,
        responseText: event.responseText,
      },
    });
  } catch (error) {
    // Log error but don't fail the main flow
    console.error("Failed to log safety event:", error);
  }
}

/**
 * Get recent safety events for a user (for admin/review purposes).
 */
export async function getRecentSafetyEvents(
  userId: string,
  limit: number = 50
): Promise<Array<{
  id: string;
  tier: number;
  category: string;
  triggerPhrase: string | null;
  userMessage: string;
  responseText: string;
  createdAt: Date;
}>> {
  return prisma.safetyAuditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      tier: true,
      category: true,
      triggerPhrase: true,
      userMessage: true,
      responseText: true,
      createdAt: true,
    },
  });
}

/**
 * Get aggregate safety stats (for monitoring dashboard).
 */
export async function getSafetyStats(
  since: Date
): Promise<{
  tier2Count: number;
  tier3Count: number;
  byCategory: Record<string, number>;
}> {
  const events = await prisma.safetyAuditLog.findMany({
    where: { createdAt: { gte: since } },
    select: { tier: true, category: true },
  });

  const tier2Count = events.filter((e) => e.tier === 2).length;
  const tier3Count = events.filter((e) => e.tier === 3).length;

  const byCategory: Record<string, number> = {};
  for (const event of events) {
    byCategory[event.category] = (byCategory[event.category] || 0) + 1;
  }

  return { tier2Count, tier3Count, byCategory };
}
