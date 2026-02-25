/**
 * Safety Classification System
 * 
 * Hard-coded checks run first to catch obvious cases.
 * LLM also classifies as part of its response.
 * Final tier = max(hard_coded, llm) for safety.
 */

import {
  TIER_3_CRISIS_KEYWORDS,
  TIER_2_MEDICAL_PATTERNS,
  TIER_2_MENTAL_KEYWORDS,
  TIER_1_ELEVATED_KEYWORDS,
  SAFETY_APPENDIX,
  type SafetyTier,
  type SafetyCategory,
  type SafetyClassification,
} from "@/config/buddy/safetyTiers";

/**
 * Hard-coded classification check.
 * Returns classification if obvious pattern detected, null otherwise.
 * LLM will also classify - we take the max tier for safety.
 */
export function hardCodedClassify(message: string): SafetyClassification | null {
  const lowerMessage = message.toLowerCase();

  // Tier 3: Crisis - check first (most severe)
  for (const keyword of TIER_3_CRISIS_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        tier: 3,
        category: "crisis",
        triggerPhrase: keyword,
        source: "hard_coded",
      };
    }
  }

  // Tier 2 Medical: Pattern matching
  for (const pattern of TIER_2_MEDICAL_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        tier: 2,
        category: "medical",
        triggerPhrase: match[0],
        source: "hard_coded",
      };
    }
  }

  // Tier 2 Mental Health: Keyword matching
  for (const keyword of TIER_2_MENTAL_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        tier: 2,
        category: "mental_health",
        triggerPhrase: keyword,
        source: "hard_coded",
      };
    }
  }

  // Tier 1 Elevated: Keyword matching (soft - LLM may override)
  for (const keyword of TIER_1_ELEVATED_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      return {
        tier: 1,
        category: "elevated",
        triggerPhrase: keyword,
        source: "hard_coded",
      };
    }
  }

  // No hard-coded match - let LLM classify
  return null;
}

/**
 * Combine hard-coded and LLM classifications.
 * Takes the more severe (higher) tier for safety.
 */
export function combineClassifications(
  hardCoded: SafetyClassification | null,
  llmTier: SafetyTier,
  llmCategory: SafetyCategory
): SafetyClassification {
  const hardCodedTier = hardCoded?.tier ?? 0;

  // Take the higher tier for safety
  if (hardCodedTier >= llmTier) {
    return hardCoded ?? {
      tier: llmTier,
      category: llmCategory,
      source: "llm",
    };
  }

  return {
    tier: llmTier,
    category: llmCategory,
    source: "llm",
  };
}

/**
 * Get the appropriate safety appendix based on tier and category.
 * Returns empty string for Tier 0 (normal/positive emotions).
 */
export function getSafetyAppendix(tier: SafetyTier, category: SafetyCategory): string {
  if (tier === 0) {
    return ""; // No appendix for normal/positive messages
  }

  if (tier === 1) {
    return SAFETY_APPENDIX.TIER_1;
  }

  if (tier === 2) {
    if (category === "medical") {
      return SAFETY_APPENDIX.TIER_2_MEDICAL;
    }
    return SAFETY_APPENDIX.TIER_2_MENTAL;
  }

  if (tier === 3) {
    return SAFETY_APPENDIX.TIER_3_CRISIS;
  }

  return "";
}
