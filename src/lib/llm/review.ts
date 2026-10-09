import { z } from "zod";
import {
  type ChecklistRule,
  type CvContent,
  type PrivateValue,
  suggestionSchema,
} from "@/lib/cv/schema";
import { cvPractice, keepTermsRule, PLACEHOLDER_RULE } from "./content";
import { generateStructured } from "./generate";
import type { ModelRef } from "./provider";

const system = (
  rules: ChecklistRule[],
) => `You review a CV the way an experienced recruiter for the candidate's field would, and list what to improve.

${cvPractice(rules)}

- Return at most 10 suggestions, most important first. Say nothing about what is already good; a CV in good shape gets few or none.
- One suggestion per problem. Group a pattern into one suggestion ("3 bullets in past tense for the current role") instead of listing each bullet.
- rule: the name of the rule above that the suggestion comes from.
- kind "fix" when it can be fixed using only what the CV already says. kind "yours" when it needs something only the candidate knows, such as a real number or result. Never suggest inventing anything.
- Write in the CV's language.
${PLACEHOLDER_RULE}`;

/**
 * Reviews a CV against the user's checklist. Every private value of the CV is masked before sending.
 * Each suggestion names one of the checklist's rules (the schema allows no other).
 */
export async function reviewCv(
  content: CvContent,
  privateValues: PrivateValue[],
  { keep = [], rules }: { keep?: string[]; rules: ChecklistRule[] },
  model: ModelRef,
) {
  const names = rules.map((r) => r.name) as [string, ...string[]];
  const { output, run } = await generateStructured({
    schema: z.object({
      suggestions: z.array(
        suggestionSchema.extend({
          rule: z.enum(names).describe("The checklist rule it comes from"),
        }),
      ),
    }),
    system: system(rules) + keepTermsRule(keep),
    prompt: `CV (JSON):\n\n${JSON.stringify(content)}`,
    privateValues,
    model,
  });
  return { suggestions: output.suggestions, run };
}
