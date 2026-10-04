import type { LanguageModel } from "ai";
import { z } from "zod";
import { blankItem, shortId } from "@/lib/cv/empty";
import {
  type CvContent,
  cvContentSchema,
  type PrivateValue,
} from "@/lib/cv/schema";
import { generateStructured } from "./generate";

// The model fills the content; ids are ours, so the list sections are sent without them.
const LIST_KEYS = Object.keys(blankItem) as (keyof typeof blankItem)[];
const parsedCvSchema = cvContentSchema.extend(
  Object.fromEntries(
    LIST_KEYS.map((key) => [
      key,
      // Widened to ZodObject: TS can't call .omit on the union of the six item schemas.
      z.array(
        (cvContentSchema.shape[key].unwrap().element as z.ZodObject).omit({
          id: true,
        }),
      ),
    ]),
  ),
);

const SYSTEM = `You convert the plain text of a CV (extracted from a PDF) into structured data.

- Copy the candidate's wording; do not rewrite, summarise, translate or invent anything.
- Personal details were replaced with placeholders such as {{NAME}}, {{EMAIL}} or {{URL_2}}. Keep a placeholder exactly as written if it belongs in a field (for example a project link), otherwise leave it out. Never guess what it stands for.
- Contact details (name, email, phone, address, links, date of birth) are handled separately: do not put them in any field.
- headline: the job title under the name, if any. summary: the profile/summary paragraph, if any.
- experience: one entry per role, newest first as in the CV; highlights are its bullet points, one string each. Dates as written (e.g. "2021", "03/2019", "Present").
- skills: group them the way the CV does; use an empty group name if the CV doesn't group them.
- Sections that don't fit the other fields (certifications, awards, volunteering, publications…) go to extras with the CV's own section title.
- Text may contain extraction artefacts such as letter-spaced headings ("S U M M A R Y") or broken lines; read through them.
- Leave a field empty rather than guessing.`;

/** Turns the text of an imported CV into structured content. Private values are masked before sending. */
export async function structureCv(
  text: string,
  privateValues: PrivateValue[],
  model?: LanguageModel,
): Promise<CvContent> {
  const parsed = await generateStructured({
    schema: parsedCvSchema,
    system: SYSTEM,
    prompt: `CV text:\n\n${text}`,
    privateValues,
    model,
  });
  const withIds = Object.fromEntries(
    LIST_KEYS.map((key) => [
      key,
      (parsed[key] as object[]).map((item) => ({ id: shortId(), ...item })),
    ]),
  );
  return cvContentSchema.parse({ ...parsed, ...withIds });
}
