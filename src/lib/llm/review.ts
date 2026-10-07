import type { LanguageModel } from "ai";
import {
  type CvContent,
  type PrivateValue,
  reviewSchema,
} from "@/lib/cv/schema";
import { CV_PRACTICE, keepTermsRule, PLACEHOLDER_RULE } from "./content";
import { generateStructured } from "./generate";

const SYSTEM = `You review a CV the way an experienced recruiter for the candidate's field would, and list what to improve.

${CV_PRACTICE}

- Return at most 10 suggestions, most important first. Say nothing about what is already good; a CV in good shape gets few or none.
- One suggestion per problem. Group a pattern into one suggestion ("3 bullets in past tense for the current role") instead of listing each bullet.
- kind "fix" when it can be fixed using only what the CV already says. kind "yours" when it needs something only the candidate knows, such as a real number or result. Never suggest inventing anything.
- Write in the CV's language.
${PLACEHOLDER_RULE}`;

/** Reviews a CV against good CV practice. Every private value of the CV is masked before sending. */
export async function reviewCv(
  content: CvContent,
  privateValues: PrivateValue[],
  { keep = [] as string[] } = {},
  model?: LanguageModel,
) {
  const { suggestions } = await generateStructured({
    schema: reviewSchema,
    system: SYSTEM + keepTermsRule(keep),
    prompt: `CV (JSON):\n\n${JSON.stringify(content)}`,
    privateValues,
    model,
  });
  return suggestions;
}
