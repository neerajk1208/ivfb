export interface Resource {
  id: string;
  title: string;
  url: string;
  description: string;
  phases: string[];
  situations: string[];
}

export const resourceLibrary: Resource[] = [
  // Stimulation phase resources
  {
    id: "stim-what-to-expect",
    title: "What to Expect During Stimulation",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/the-ivf-process-step-by-step",
    description: "Comprehensive guide to the stimulation phase",
    phases: ["stimulation_day_1", "stimulation_day_2", "stimulation_day_3"],
    situations: ["starting_meds", "first_cycle"],
  },
  {
    id: "injection-tips",
    title: "Injection Tips & Techniques",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/ivf-injections-and-protocols",
    description: "Videos and guides for self-injection",
    phases: ["stimulation_day_1", "stimulation_day_2"],
    situations: ["injection_anxiety", "first_injection"],
  },
  {
    id: "side-effects-guide",
    title: "Managing Stimulation Side Effects",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/ivf-side-effects-and-complications",
    description: "Common side effects and coping strategies",
    phases: ["stimulation_day_4", "stimulation_day_5", "stimulation_day_6", "stimulation_day_7", "stimulation_day_8"],
    situations: ["bloating", "mood_swings", "headaches", "fatigue"],
  },
  {
    id: "follicle-monitoring",
    title: "Understanding Follicle Monitoring",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/monitoring-during-ivf",
    description: "What monitoring appointments reveal",
    phases: ["stimulation_day_5", "stimulation_day_6", "stimulation_day_7", "stimulation_day_8"],
    situations: ["monitoring_anxiety", "follicle_questions"],
  },

  // Trigger & Retrieval
  {
    id: "trigger-timing",
    title: "Trigger Shot Timing",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/ivf-injections-and-protocols#trigger-shot",
    description: "Why timing matters for trigger",
    phases: ["pre_trigger", "trigger_day"],
    situations: ["trigger_anxiety", "timing_questions"],
  },
  {
    id: "retrieval-prep",
    title: "Preparing for Egg Retrieval",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/the-egg-retrieval-procedure",
    description: "What to expect during retrieval",
    phases: ["trigger_day", "retrieval_day"],
    situations: ["retrieval_anxiety", "anesthesia_questions"],
  },
  {
    id: "post-retrieval-care",
    title: "Recovery After Retrieval",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/after-the-egg-retrieval",
    description: "Recovery tips and warning signs",
    phases: ["retrieval_day", "post_retrieval_day_1", "post_retrieval_day_2", "post_retrieval_day_3"],
    situations: ["pain_management", "ohss_concern", "recovery"],
  },

  // Transfer & TWW
  {
    id: "transfer-prep",
    title: "Embryo Transfer Day",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/the-embryo-transfer",
    description: "What to expect during transfer",
    phases: ["transfer_day"],
    situations: ["transfer_anxiety", "full_bladder_tips"],
  },
  {
    id: "tww-survival",
    title: "Surviving the Two-Week Wait",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/after-the-embryo-transfer",
    description: "Coping strategies for the wait",
    phases: ["tww_day_1", "tww_day_2", "tww_day_3", "tww_day_4", "tww_day_5", "tww_day_6", "tww_day_7"],
    situations: ["tww_anxiety", "symptom_spotting", "waiting"],
  },
  {
    id: "beta-testing",
    title: "Understanding Your Beta HCG",
    url: "https://www.fertilityiq.com/ivf-in-vitro-fertilization/understanding-your-results",
    description: "What your beta results mean",
    phases: ["tww_day_9", "tww_day_10", "tww_day_11", "tww_day_12", "tww_day_13", "tww_day_14"],
    situations: ["beta_approaching", "results_anxiety"],
  },

  // Emotional support
  {
    id: "emotional-support",
    title: "Emotional Support During IVF",
    url: "https://www.fertilityiq.com/mental-health-and-fertility/coping-with-infertility",
    description: "Managing the emotional toll",
    phases: [],
    situations: ["sad", "anxious", "overwhelmed", "frustrated", "angry"],
  },
  {
    id: "partner-support",
    title: "Supporting Your Partner",
    url: "https://www.fertilityiq.com/mental-health-and-fertility/fertility-and-relationships",
    description: "Communication tips for couples",
    phases: [],
    situations: ["relationship_stress", "partner_support", "communication"],
  },
  {
    id: "self-care",
    title: "Self-Care During Treatment",
    url: "https://www.fertilityiq.com/mental-health-and-fertility/self-care-during-ivf",
    description: "Practical self-care ideas",
    phases: [],
    situations: ["self_care", "stress", "burnout"],
  },
];

export function getResourcesForContext(
  phase: string,
  situations: string[],
  limit: number = 2
): Resource[] {
  const phaseMatches = resourceLibrary.filter(
    (r) => r.phases.includes(phase) || r.phases.some((p) => phase.startsWith(p.replace(/_\d+$/, "")))
  );

  const situationMatches = resourceLibrary.filter((r) =>
    r.situations.some((s) => situations.some((sit) => sit.toLowerCase().includes(s)))
  );

  const combined = [...new Set([...phaseMatches, ...situationMatches])];

  return combined.slice(0, limit);
}
