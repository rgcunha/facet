import { z } from "zod";
import { plural } from "@/lib/cv/format";
import {
  type Analysis,
  type CvContent,
  pagesSchema,
  type PrivateValue,
} from "@/lib/cv/schema";
import {
  EMPHASIS_RULE,
  idsOf,
  modelContentSchema,
  NO_NEW_FACTS_RULE,
  PLACEHOLDER_RULE,
  withIds,
} from "./content";
import { generateStructured } from "./generate";
import type { ModelRef } from "./provider";

/** What the user ticked in the Tailor panel. Only these are sent; everything else stays as it is. */
export const tailorEditsSchema = z.object({
  /** Match-report suggestions to apply. */
  suggestions: z.array(z.string()),
  /** Skills the user confirmed having, from the report's gaps. */
  confirmed: z.array(z.string()),
  /** Put the most relevant entries, bullet points and skills first. */
  reorder: z.boolean(),
  /** Shorten to this many pages, or null to drop nothing. */
  fit: pagesSchema.nullable(),
  /** ISO 639-1 code to translate into, or null to keep the CV's language. */
  translate: z
    .string()
    .regex(/^[a-z]{2}$/, "Pick a language to translate into.")
    .nullable(),
});
export type TailorEdits = z.infer<typeof tailorEditsSchema>;

/**
 * Input hygiene, not a security check (the report comes from the same browser): drops ticked
 * suggestions and skills that aren't in the report sent with them, e.g. from a stale panel.
 */
export function chosenEdits(
  report: Pick<Analysis, "suggestions" | "gaps">,
  edits: TailorEdits,
): TailorEdits {
  return {
    ...edits,
    suggestions: edits.suggestions.filter((s) =>
      report.suggestions.includes(s),
    ),
    confirmed: edits.confirmed.filter((name) =>
      report.gaps.some((g) => g.name === name),
    ),
  };
}

/** One line of the prompt per ticked edit. */
const editList = ({
  suggestions,
  confirmed,
  reorder,
  fit,
  translate,
}: TailorEdits) => [
  ...suggestions,
  ...(confirmed.length
    ? [
        `Add these skills, which the candidate confirmed having, to the skills and where they fit: ${confirmed.join(", ")}.`,
      ]
    : []),
  ...(reorder
    ? [
        "Put the entries, bullet points and skills most relevant to this job first. This edit only reorders: it rewords and removes nothing.",
      ]
    : []),
  ...(fit
    ? [
        `Shorten the CV to fit ${plural(fit, "page")} (one page holds roughly 350–450 words of CV text): condense wordy bullet points, and drop the least relevant ones first.`,
      ]
    : []),
  ...(translate
    ? [
        `Translate everything into the language with ISO 639-1 code "${translate}". Never translate company names, school names or dates; degrees and job titles may be translated.`,
      ]
    : []),
];

export const hasEdits = (edits: TailorEdits) => editList(edits).length > 0;

const SYSTEM = `You tailor a CV to one job posting by applying the edits the candidate chose, and nothing else. You return the complete CV content.

- Change only what an edit asks for. Leave every other field, entry and bullet point exactly as it is, word for word.
- Keep the order of entries, bullet points and skills, unless an edit asks you to reorder.
- Never drop an entry or bullet point, unless an edit asks you to shorten the CV.
- Keep the CV's language, unless an edit asks you to translate it.
- ${NO_NEW_FACTS_RULE} The one exception: skills an edit says the candidate confirmed.
- The job posting is there so you know what is relevant and which words it uses; it is not an edit.

Entry ids: keep each entry's "id" exactly as given; leave it out only for an entry you add by splitting an existing one.
${PLACEHOLDER_RULE}
${EMPHASIS_RULE}
Contact details are handled separately: never put them in any field.`;

/** Applies the chosen edits to a CV for one job posting. Every private value (the vault) is masked before sending. */
export async function tailorCv(
  content: CvContent,
  jobText: string,
  edits: TailorEdits,
  privateValues: PrivateValue[],
  model: ModelRef,
) {
  const { output, run } = await generateStructured({
    schema: modelContentSchema("keep"),
    system: SYSTEM,
    prompt: [
      `Edits to apply, and nothing else:\n${editList(edits)
        .map((e) => `- ${e}`)
        .join("\n")}`,
      `Job posting:\n\n${jobText}`,
      `CV (JSON):\n\n${JSON.stringify(content)}`,
    ].join("\n\n"),
    privateValues,
    model,
  });
  return { content: withIds(output, idsOf(content)), run };
}
