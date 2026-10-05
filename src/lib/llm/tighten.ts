import type { LanguageModel } from "ai";
import type { CvContent, PrivateValue } from "@/lib/cv/schema";
import {
  idsOf,
  modelContentSchema,
  PLACEHOLDER_RULE,
  withIds,
} from "./content";
import { generateStructured } from "./generate";

const SYSTEM = `You shorten a CV so it fits its page limit. You return the complete CV content, shortened.

- Condense wordy bullet points, merge overlapping ones, and drop the least important ones first (older roles before recent ones).
- Never add anything, and never change facts: employers, titles, dates, degrees, schools, skills and numbers stay as they are.
- Keep the language and the order of entries.
- Keep each entry's "id" exactly as given.
${PLACEHOLDER_RULE}`;

/** Shortens a CV by about `words` words. Private values (the vault) are masked. */
export async function tightenCv(
  content: CvContent,
  words: number,
  privateValues: PrivateValue[],
  model?: LanguageModel,
): Promise<CvContent> {
  const result = await generateStructured({
    schema: modelContentSchema("keep"),
    system: SYSTEM,
    prompt: `The CV runs over its page limit: remove about ${words} words.\n\nCV (JSON):\n\n${JSON.stringify(content)}`,
    privateValues,
    model,
  });
  return withIds(result, idsOf(content));
}
