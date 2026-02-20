export const severeKeywords = [
  "severe pain",
  "can't breathe",
  "cannot breathe",
  "difficulty breathing",
  "heavy bleeding",
  "soaking through",
  "passing clots",
  "fainting",
  "fainted",
  "passed out",
  "chest pain",
  "heart racing",
  "suicidal",
  "want to die",
  "end my life",
  "kill myself",
  "panic attack",
  "can't stop crying",
  "emergency",
  "hospital",
  "911",
  "ambulance",
  "collapsed",
  "unconscious",
  "high fever",
  "vomiting blood",
  "severe headache",
  "vision problems",
  "blurred vision",
  "sudden swelling",
  "can't urinate",
  "blood in urine",
];

export const escalationResponse = `I'm concerned about what you're describing. Please contact your clinic or urgent care right away. If it's an emergency, call 911. Your health and safety come first 💛`;

export function containsSevereKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return severeKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
}
