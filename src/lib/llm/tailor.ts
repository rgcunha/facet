import type { LanguageModel } from "ai";
import { z } from "zod";
import { plural } from "@/lib/cv/format";
import type { CvContent, MatchReport, PrivateValue } from "@/lib/cv/schema";
import {
  idsOf,
  modelContentSchema,
  PLACEHOLDER_RULE,
  withIds,
} from "./content";
import { generateStructured } from "./generate";

const tailoredSchema = z.object({
  content: modelContentSchema("keep"),
  job: z.object({
    title: z.string(),
    company: z.string(),
    language: z
      .string()
      .describe(
        "ISO 639-1 code of the job posting's language, e.g. en, de, pt",
      ),
  }),
});

const SYSTEM = `You tailor a CV to one job posting. You return the complete CV content, adapted.

You may:
- reorder entries, bullet points and skills so the most relevant come first;
- rephrase bullet points, the headline and the summary to use the posting's vocabulary, where the meaning stays true to the original;
- shorten or drop bullet points, entries and skills that are irrelevant to this job, to fit the target length;
- translate everything into the requested output language.

You must never:
- add employers, job titles, dates, degrees, schools, certifications, skills, tools, technologies, numbers or achievements that the CV doesn't already contain;
- change or translate company names, school names or dates (degrees and job titles may be translated);
- claim a requirement the candidate doesn't show. The only exception is the skills the candidate confirmed: you may add those to skills and mention them where they fit.

Entry ids: keep each entry's "id" exactly as given; leave it out only for an entry you add by splitting an existing one.
${PLACEHOLDER_RULE}
Contact details are handled separately: never put them in any field.
Length: one page holds roughly 350–450 words of CV text; two pages about twice that.`;

/** Adapts a CV to a job posting. Every private value (the vault) is masked before sending. */
export async function tailorCv(
  content: CvContent,
  jobText: string,
  options: {
    language: string;
    pages: 1 | 2;
    report: Pick<MatchReport, "confirmed" | "suggestions">;
  },
  privateValues: PrivateValue[],
  model?: LanguageModel,
) {
  const result = await generateStructured({
    schema: tailoredSchema,
    system: SYSTEM,
    prompt: [
      `Target length: ${plural(options.pages, "page")}.`,
      `Output language: ${options.language || "the language of the job posting"}.`,
      `Skills the candidate confirmed having: ${options.report.confirmed.join(", ") || "none"}.`,
      `Suggestions to apply where they stay true:\n${options.report.suggestions.map((s) => `- ${s}`).join("\n") || "none"}`,
      `Job posting:\n\n${jobText}`,
      `CV (JSON):\n\n${JSON.stringify(content)}`,
    ].join("\n\n"),
    privateValues,
    model,
  });
  return { ...result, content: withIds(result.content, idsOf(content)) };
}
