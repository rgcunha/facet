import { z } from "zod";
import type { PrivateValue } from "@/lib/cv/schema";
import { modelContentSchema, PLACEHOLDER_RULE, withIds } from "./content";
import { generateStructured } from "./generate";
import type { ModelRef } from "./provider";

const SYSTEM = `You convert the plain text of a CV (extracted from a PDF) into structured data.

- Copy the candidate's wording; do not rewrite, summarise, translate or invent anything.
- ${PLACEHOLDER_RULE} (For example a project link may be a placeholder.)
- Contact details (name, email, phone, address, links, date of birth) are handled separately: do not put them in any field.
- headline: the job title under the name, if any. summary: the profile/summary paragraph, if any.
- experience: one entry per role, newest first as in the CV; highlights are its bullet points, one string each. Dates as written (e.g. "2021", "03/2019", "Present").
- A role's heading often holds the company and the job title on one line, in either order, split by a comma, "|", "-" or "–" (e.g. "ACME | Senior Software Engineer", "Acme GmbH, Product Engineer", "Backend Developer – Acme"). Put the job title in role and the employer in company. Never drop the job title; a role is only empty if the CV really gives none.
- skills: group them the way the CV does; use an empty group name if the CV doesn't group them.
- Sections that don't fit the other fields (certifications, awards, volunteering, publications…) go to extras with the CV's own section title.
- Text may contain extraction artefacts such as letter-spaced headings ("S U M M A R Y") or broken lines; read through them.
- Leave a field empty rather than guessing.`;

/** Turns the text of an imported CV into structured content. Private values are masked before sending. */
export async function structureCv(
  text: string,
  privateValues: PrivateValue[],
  model: ModelRef,
) {
  const { output, run } = await generateStructured({
    schema: modelContentSchema("omit").extend({
      language: z
        .string()
        .describe("ISO 639-1 code of the CV's language, e.g. en, de, pt"),
    }),
    system: SYSTEM,
    prompt: `CV text:\n\n${text}`,
    privateValues,
    model,
  });
  return { content: withIds(output), language: String(output.language), run };
}
