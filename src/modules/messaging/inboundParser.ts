export interface ParsedCheckIn {
  mood: number | null;
  symptoms: string[];
  note: string;
  isOptOut: boolean;
}

const STOP_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "end"];

const SYMPTOM_KEYWORDS: Record<string, string> = {
  bloated: "bloating",
  bloating: "bloating",
  cramp: "cramps",
  cramps: "cramps",
  cramping: "cramps",
  anxious: "anxiety",
  anxiety: "anxiety",
  worried: "anxiety",
  sad: "sadness",
  down: "sadness",
  low: "sadness",
  nausea: "nausea",
  nauseous: "nausea",
  sick: "nausea",
  tired: "fatigue",
  exhausted: "fatigue",
  fatigue: "fatigue",
  headache: "headache",
  "head ache": "headache",
  dizzy: "dizziness",
  dizziness: "dizziness",
  moody: "mood swings",
  "mood swings": "mood swings",
  emotional: "mood swings",
  sore: "soreness",
  tender: "soreness",
  pain: "pain",
  uncomfortable: "discomfort",
  discomfort: "discomfort",
  hot: "hot flashes",
  "hot flash": "hot flashes",
  "hot flashes": "hot flashes",
  insomnia: "insomnia",
  "can't sleep": "insomnia",
  "sleep issues": "insomnia",
};

export function parseInboundMessage(body: string): ParsedCheckIn {
  const normalizedBody = body.toLowerCase().trim();

  const isOptOut = STOP_KEYWORDS.some(
    (kw) => normalizedBody === kw || normalizedBody.startsWith(`${kw} `)
  );

  if (isOptOut) {
    return {
      mood: null,
      symptoms: [],
      note: body,
      isOptOut: true,
    };
  }

  let mood: number | null = null;
  const moodMatch = normalizedBody.match(/^(\d)\s*$/);
  if (moodMatch) {
    const num = parseInt(moodMatch[1]);
    if (num >= 1 && num <= 5) {
      mood = num;
    }
  }

  if (mood === null) {
    const inlineMoodMatch = normalizedBody.match(/\b([1-5])\s*(?:out of 5|\/5)?\b/);
    if (inlineMoodMatch) {
      mood = parseInt(inlineMoodMatch[1]);
    }
  }

  const symptoms: string[] = [];
  for (const [keyword, symptom] of Object.entries(SYMPTOM_KEYWORDS)) {
    if (normalizedBody.includes(keyword) && !symptoms.includes(symptom)) {
      symptoms.push(symptom);
    }
  }

  let note = body;
  if (mood !== null && moodMatch) {
    note = "";
  }

  return {
    mood,
    symptoms,
    note: note.trim(),
    isOptOut: false,
  };
}
