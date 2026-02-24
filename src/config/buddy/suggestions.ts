export interface Suggestion {
  id: string;
  text: string;
  category: "coping" | "physical" | "emotional" | "practical" | "partner";
  phases: string[];
  situations: string[];
  mood?: { min?: number; max?: number };
}

export const suggestionLibrary: Suggestion[] = [
  // Coping strategies
  {
    id: "breathing-5-5",
    text: "Try the 5-5-5 breathing: inhale 5 seconds, hold 5 seconds, exhale 5 seconds. It helps calm your nervous system before injections.",
    category: "coping",
    phases: [],
    situations: ["injection_anxiety", "anxious", "nervous"],
  },
  {
    id: "ice-injection",
    text: "Ice the injection site for 2-3 minutes before. It numbs the area and makes it less noticeable.",
    category: "physical",
    phases: ["stimulation_day_1", "stimulation_day_2", "stimulation_day_3"],
    situations: ["injection_pain", "first_injection"],
  },
  {
    id: "tww-distraction",
    text: "Try scheduling something enjoyable for each day of the wait - a walk, a show to binge, coffee with a friend. Structure helps.",
    category: "coping",
    phases: ["tww_day_1", "tww_day_2", "tww_day_3", "tww_day_4", "tww_day_5"],
    situations: ["tww_anxiety", "waiting", "impatient"],
  },
  {
    id: "symptom-spotting",
    text: "Symptom spotting is so tempting but rarely reliable. The progesterone makes everything feel like 'a sign'. Focus on what you can control today.",
    category: "emotional",
    phases: ["tww_day_3", "tww_day_4", "tww_day_5", "tww_day_6", "tww_day_7", "tww_day_8"],
    situations: ["symptom_spotting", "analyzing", "worried"],
  },
  {
    id: "journal-fears",
    text: "Consider journaling your fears - getting them out of your head and onto paper can take away some of their power.",
    category: "emotional",
    phases: [],
    situations: ["anxious", "overwhelmed", "scared"],
    mood: { max: 2 },
  },
  {
    id: "limit-googling",
    text: "Set a 'Google curfew' - no fertility searches after 8pm. Late-night rabbit holes rarely help and often hurt.",
    category: "coping",
    phases: [],
    situations: ["googling", "researching", "anxious"],
  },

  // Physical comfort
  {
    id: "bloating-electrolytes",
    text: "For bloating, try coconut water or electrolyte drinks. Your body is working hard and needs extra hydration.",
    category: "physical",
    phases: ["stimulation_day_5", "stimulation_day_6", "stimulation_day_7", "stimulation_day_8"],
    situations: ["bloating", "uncomfortable"],
  },
  {
    id: "heat-pad",
    text: "A heating pad on low can help with injection site soreness. Just don't use it directly on your belly during stims.",
    category: "physical",
    phases: [],
    situations: ["sore", "injection_pain", "cramping"],
  },
  {
    id: "protein-retrieval",
    text: "High-protein foods help recovery after retrieval - eggs, Greek yogurt, nuts. Your body needs fuel to heal.",
    category: "physical",
    phases: ["retrieval_day", "post_retrieval_day_1", "post_retrieval_day_2"],
    situations: ["recovery", "tired", "weak"],
  },
  {
    id: "loose-clothing",
    text: "Loose, comfortable clothing is your friend during stims. Your ovaries are working overtime.",
    category: "practical",
    phases: ["stimulation_day_6", "stimulation_day_7", "stimulation_day_8", "retrieval_day"],
    situations: ["bloating", "uncomfortable"],
  },

  // Emotional support
  {
    id: "its-okay-cry",
    text: "It's okay to cry. These hormones are intense and this journey is hard. Let yourself feel it.",
    category: "emotional",
    phases: [],
    situations: ["sad", "crying", "emotional"],
    mood: { max: 2 },
  },
  {
    id: "not-alone",
    text: "You're not alone in this, even when it feels like it. Millions of people are in the same waiting rooms, feeling the same things.",
    category: "emotional",
    phases: [],
    situations: ["lonely", "isolated", "sad"],
    mood: { max: 2 },
  },
  {
    id: "one-day-at-time",
    text: "One day at a time. You don't have to think about the whole journey - just today.",
    category: "emotional",
    phases: [],
    situations: ["overwhelmed", "anxious", "stressed"],
    mood: { max: 3 },
  },

  // Partner/relationships
  {
    id: "partner-tasks",
    text: "Let your partner help where they can - prep the injection supplies, set reminders, handle the logistics. It helps them feel involved.",
    category: "partner",
    phases: ["stimulation_day_1", "stimulation_day_2"],
    situations: ["partner_support", "asking_for_help"],
  },
  {
    id: "check-in-partner",
    text: "Consider checking in with your partner about how they're doing too. They're on this journey with you.",
    category: "partner",
    phases: [],
    situations: ["partner_stress", "relationship"],
  },

  // Practical tips
  {
    id: "alarm-meds",
    text: "Set multiple alarms for your medication times - and label them clearly so you know which med is which.",
    category: "practical",
    phases: ["stimulation_day_1", "stimulation_day_2"],
    situations: ["forgetting", "medication_timing"],
  },
  {
    id: "med-supplies",
    text: "Keep backup supplies in your bag - alcohol wipes, a sharps container, written instructions. You never know when you'll need them.",
    category: "practical",
    phases: [],
    situations: ["traveling", "prepared"],
  },
];

export function getSuggestionsForContext(
  phase: string,
  situations: string[],
  mood: number | null,
  previousSuggestionIds: string[],
  limit: number = 2
): Suggestion[] {
  const eligible = suggestionLibrary.filter((s) => {
    if (previousSuggestionIds.includes(s.id)) return false;

    if (s.mood) {
      if (mood === null) return false;
      if (s.mood.min !== undefined && mood < s.mood.min) return false;
      if (s.mood.max !== undefined && mood > s.mood.max) return false;
    }

    const phaseMatch = s.phases.length === 0 || s.phases.some((p) => phase.startsWith(p.replace(/_\d+$/, "")));
    const situationMatch = situations.some((sit) =>
      s.situations.some((ss) => sit.toLowerCase().includes(ss.toLowerCase()))
    );

    return phaseMatch || situationMatch;
  });

  return eligible.slice(0, limit);
}
