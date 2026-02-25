/**
 * Post-LLM Response Filter
 * 
 * Filters out toxic positivity, medical advice, and enforces quality.
 * Applied to LLM output before sending to user.
 */

// Phrases that minimize feelings or are dismissively positive
const TOXIC_POSITIVITY_PHRASES = [
  "everything happens for a reason",
  "it was meant to be",
  "meant to be",
  "stay positive",
  "just stay positive",
  "think positive",
  "good vibes only",
  "at least you",
  "others have it worse",
  "could be worse",
  "don't worry",
  "just relax",
  "try to relax",
  "just breathe",
  "stop worrying",
  "try not to stress",
  "don't stress",
  "it'll all work out",
  "it will all work out",
  "everything will be fine",
  "i'm sure it will be fine",
  "probably fine",
  "i understand exactly how you feel",
  "i know exactly how you feel",
  "i totally understand",
];

// Phrases that could constitute medical advice
const MEDICAL_ADVICE_PHRASES = [
  "you should take",
  "try taking",
  "take some",
  "increase your dose",
  "decrease your dose",
  "lower your dose",
  "stop taking",
  "skip your",
  "sounds like you have",
  "you probably have",
  "this means you have",
  "this indicates",
  "this is a sign of",
  "you might have",
  "you may have",
  "i think you have",
  "it's likely that",
  "this is definitely",
  "this is certainly",
];

// Phrases that are too clinical/cold
const CLINICAL_PHRASES = [
  "as an ai",
  "as a language model",
  "i cannot diagnose",
  "i am not a doctor",
  "consult your physician",
  "seek medical attention",
  "according to my training",
];

/**
 * Filter LLM response for problematic content.
 * Removes toxic positivity, flags medical advice, softens clinical language.
 */
export function filterResponse(response: string): string {
  let filtered = response;

  // Remove toxic positivity phrases (case-insensitive)
  for (const phrase of TOXIC_POSITIVITY_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    filtered = filtered.replace(regex, "");
  }

  // Replace medical advice phrases with safe alternatives
  for (const phrase of MEDICAL_ADVICE_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}`, "gi");
    if (regex.test(filtered)) {
      // Replace the sentence containing medical advice
      filtered = filtered.replace(
        new RegExp(`[^.!?]*${escapeRegex(phrase)}[^.!?]*[.!?]?`, "gi"),
        "Please check with your clinic about this."
      );
    }
  }

  // Soften clinical phrases
  for (const phrase of CLINICAL_PHRASES) {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
    filtered = filtered.replace(regex, "");
  }

  // Clean up any double spaces or awkward punctuation from removals
  filtered = filtered
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/([.,!?])\s*([.,!?])/g, "$1")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n{3,}/g, "\n\n");

  // Enforce max length (320 chars for SMS compatibility, but allow a bit more for chat)
  const MAX_LENGTH = 400;
  if (filtered.length > MAX_LENGTH) {
    // Try to cut at a sentence boundary
    const truncated = filtered.slice(0, MAX_LENGTH);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastQuestion = truncated.lastIndexOf("?");
    const lastExclaim = truncated.lastIndexOf("!");
    const cutPoint = Math.max(lastPeriod, lastQuestion, lastExclaim);
    
    if (cutPoint > MAX_LENGTH * 0.6) {
      filtered = truncated.slice(0, cutPoint + 1);
    } else {
      filtered = truncated.slice(0, MAX_LENGTH - 3) + "...";
    }
  }

  return filtered.trim();
}

/**
 * Check if response contains potentially problematic content.
 * Returns array of issues found (for logging/debugging).
 */
export function checkResponseIssues(response: string): string[] {
  const issues: string[] = [];
  const lowerResponse = response.toLowerCase();

  for (const phrase of TOXIC_POSITIVITY_PHRASES) {
    if (lowerResponse.includes(phrase)) {
      issues.push(`toxic_positivity: "${phrase}"`);
    }
  }

  for (const phrase of MEDICAL_ADVICE_PHRASES) {
    if (lowerResponse.includes(phrase)) {
      issues.push(`medical_advice: "${phrase}"`);
    }
  }

  return issues;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
