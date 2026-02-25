/**
 * Safety Tier System for IVF Buddy
 * 
 * Tier 0: Normal - everyday emotions (happy, anxious, stressed, excited)
 * Tier 1: Elevated - hopelessness, despair, feeling like failure
 * Tier 2: Risk - panic attacks, can't stop crying, medical symptoms
 * Tier 3: Crisis - suicidal ideation, self-harm
 * 
 * Both LLM response AND scaled safety appendix are always shown.
 */

// Tier 3: Crisis keywords - hard-coded for safety
export const TIER_3_CRISIS_KEYWORDS = [
  "kill myself",
  "suicide",
  "suicidal",
  "end my life",
  "take my life",
  "hurt myself",
  "harm myself",
  "don't want to live",
  "dont want to live",
  "better off dead",
  "no reason to live",
  "want to die",
  "wanna die",
  "end it all",
  "can't go on living",
];

// Tier 2 Medical: Patterns that could indicate emergencies
export const TIER_2_MEDICAL_PATTERNS = [
  // OHSS indicators
  /(?:bloat|swollen|abdomen|belly).*(?:can'?t breathe|hard to breathe|shortness|difficult)/i,
  /(?:can'?t breathe|hard to breathe|shortness).*(?:bloat|swollen|abdomen)/i,
  /gained?\s*\d+\s*(?:lb|pound|kg).*(?:day|days)/i,
  /can'?t (?:pee|urinate)/i,
  
  // Clot risk
  /(?:leg|calf).*(?:swollen|swelling|pain|red|warm)/i,
  /(?:swollen|swelling|pain).*(?:leg|calf)/i,
  /shortness of breath.*(?:chest|swelling)/i,
  
  // Bleeding
  /heavy bleeding/i,
  /soaking.*(?:pad|through)/i,
  /passing.*clots/i,
  /hemorrhag/i,
  
  // Fever
  /fever.*(?:10[1-4]|high)/i,
  /(?:10[1-4]).*fever/i,
  
  // Other emergencies
  /vomiting blood/i,
  /blood in (?:urine|stool)/i,
  /faint(?:ed|ing)|passed out|collapsed|unconscious/i,
  /severe headache.*(?:vision|blurred|spots)/i,
  /(?:vision|blurred|spots).*severe headache/i,
  /sudden vision (?:problem|change|loss)/i,
  /chest pain/i,
];

// Tier 2 Mental Health: Patterns (hard-coded helpers, LLM also classifies)
export const TIER_2_MENTAL_KEYWORDS = [
  "panic attack",
  "having a panic attack",
  "can't stop crying",
  "crying for hours",
  "haven't slept in days",
  "can't get out of bed",
  "don't want to wake up",
  "wish i could disappear",
  "wish i wasn't here",
  "can't function",
  "breaking down",
  "mental breakdown",
];

// Tier 1 Elevated: Hopelessness indicators (LLM primarily handles, these help)
export const TIER_1_ELEVATED_KEYWORDS = [
  "hopeless",
  "no hope",
  "lost all hope",
  "what's the point",
  "feel like a failure",
  "i'm a failure",
  "can't do this anymore",
  "giving up",
  "ready to give up",
  "losing hope",
  "never going to work",
  "never gonna work",
  "empty inside",
  "completely broken",
  "defeated",
];

// Safety appendix templates - scaled by tier
export const SAFETY_APPENDIX = {
  TIER_1: `\n\n---\nIf you're having a hard time, your clinic has support resources. 💛`,
  
  TIER_2_MENTAL: `\n\n---\nIf you're struggling emotionally, you're not alone. Your clinic has support resources, or you can reach 988 (call/text) anytime.`,
  
  TIER_2_MEDICAL: `\n\n---\n⚠️ These symptoms could need medical attention.\nPlease contact your clinic now. If you can't reach them and symptoms are severe, go to the ER or call 911.`,
  
  TIER_3_CRISIS: `\n\n---\nI want to make sure you have support right now.\nIf you're having thoughts of hurting yourself:\n• Call or text 988 for immediate support\n• Text HOME to 741741\n• Reach out to someone you trust\n\nYou don't have to carry this alone.`,
};

export type SafetyTier = 0 | 1 | 2 | 3;
export type SafetyCategory = "normal" | "positive" | "elevated" | "mental_health" | "medical" | "crisis";

export interface SafetyClassification {
  tier: SafetyTier;
  category: SafetyCategory;
  triggerPhrase?: string;
  source: "hard_coded" | "llm";
}
