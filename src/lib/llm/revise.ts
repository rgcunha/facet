import type {
  ChecklistRule,
  CvContent,
  PrivateValue,
  Suggestion,
} from "@/lib/cv/schema";
import {
  cvPractice,
  EMPHASIS_RULE,
  idsOf,
  keepTermsRule,
  modelContentSchema,
  NO_NEW_FACTS_RULE,
  PLACEHOLDER_RULE,
  withIds,
} from "./content";
import { generateStructured } from "./generate";
import type { ModelRef } from "./provider";

const system = (
  rules: ChecklistRule[],
) => `You edit a CV as instructed. You return the complete CV content, edited.

- Change only what the instruction asks for; leave everything else exactly as it is. Never drop an entry or bullet point unless the instruction asks for it.
- ${NO_NEW_FACTS_RULE} The one exception: facts the instruction itself states come from the candidate, and you may add them where they belong. If the instruction needs something neither it nor the CV says, do only the part you can do without it.
- Keep the language and the order of entries, unless the instruction asks otherwise.
- Keep each entry's "id" exactly as given.
- What you rewrite follows good CV practice:
${cvPractice(rules)}
${PLACEHOLDER_RULE}
${EMPHASIS_RULE}
Contact details are handled separately: never put them in any field.`;

/** For "Tighten to fit": shorten by about `overflowLines` lines, aiming a little over so the result really fits. */
export const tightenInstruction = (
  overflowLines: number,
  wordsPerLine: number,
) =>
  `The CV runs over its page limit: remove about ${Math.ceil(Math.max(1, overflowLines) * wordsPerLine * 1.2)} words. Condense wordy bullet points, merge overlapping ones, and drop the least important ones first (older roles before recent ones).`;

/** For Apply in the Review panel: the ticked fixes. Suggestions only the user can act on are never sent. */
export const applyInstruction = (suggestions: Suggestion[]) =>
  [
    "Apply these review fixes, and nothing else:",
    ...suggestions
      .filter((s) => s.kind === "fix")
      .map(
        (s) =>
          `- ${s.entryId ? `${s.area} entry "${s.entryId}"` : s.area}: ${s.problem}. ${s.detail}`,
      ),
  ].join("\n");

/**
 * Edits a CV as instructed: Tighten to fit, the fixes from a review, or the user's own instruction.
 * Private values are masked, in the instruction as well as the CV.
 */
export async function reviseCv(
  content: CvContent,
  instruction: string,
  privateValues: PrivateValue[],
  { keep = [], rules }: { keep?: string[]; rules: ChecklistRule[] },
  model: ModelRef,
) {
  const { output, run } = await generateStructured({
    schema: modelContentSchema("keep"),
    system: system(rules) + keepTermsRule(keep),
    prompt: `Instruction:\n\n${instruction}\n\nCV (JSON):\n\n${JSON.stringify(content)}`,
    privateValues,
    model,
  });
  return { content: withIds(output, idsOf(content)), run };
}
