import type { ChecklistRule } from "./schema";

/** The review checklist until the user edits it, and what "Reset to default" restores. */
export const DEFAULT_CHECKLIST: ChecklistRule[] = [
  {
    name: "Impact",
    text: "Each bullet shows impact, not a duty. Impact needn't be a number: scope and ownership, before → after, technical difficulty, who benefited, adoption by others, reliability or risk removed, and leadership all count. Use a number only when the CV already has it.",
  },
  {
    name: "Strong verbs",
    text: 'Bullets start with a strong verb. No filler or clichés ("passionate", "results-driven", "responsible for", "helped with", "various", "successfully").',
  },
  {
    name: "Tense",
    text: 'Present tense for the current role, past tense for earlier ones. No "I" or "my".',
  },
  {
    name: "Consistency",
    text: "One date format, punctuation style and spelling variant throughout.",
  },
  {
    name: "Summary",
    text: "The summary is 2–3 lines on level and focus, and doesn't repeat the headline.",
  },
  {
    name: "Focus",
    text: "Older roles get fewer bullets than recent ones. Vague bullets are made specific or dropped.",
  },
  {
    name: "Skills",
    text: "Skills are grouped, and the most important ones are backed by the experience.",
  },
];
