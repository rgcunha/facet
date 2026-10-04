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

/** Shortens a CV by about `overflowLines` lines of the template. Private values (the vault) are masked. */
export async function tightenCv(
  content: CvContent,
  overflowLines: number,
  privateValues: PrivateValue[],
  model?: LanguageModel,
): Promise<CvContent> {
  const result = await generateStructured({
    schema: modelContentSchema("keep"),
    system: SYSTEM,
    // A template line holds about 12 words; aim a little lower so the result really fits.
    prompt: `The CV runs ${overflowLines} lines over its page limit: remove about ${Math.ceil(overflowLines * 12 * 1.2)} words.\n\nCV (JSON):\n\n${JSON.stringify(content)}`,
    privateValues,
    model,
  });
  return withIds(result, idsOf(content));
}
