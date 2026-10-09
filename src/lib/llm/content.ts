import { z } from "zod";
import { shortId } from "@/lib/cv/empty";
import {
  type ChecklistRule,
  type CvContent,
  cvContentSchema,
  LIST_SECTIONS,
  type ListSection,
} from "@/lib/cv/schema";

/**
 * The model must see every field as required. The AI SDK builds its JSON schema from the input side,
 * where a field with a default is optional, and models then skip fields such as a job's `role`.
 * Shallow on purpose: only the fields of one object lose their default, which covers every level
 * of CvContent today (a nested object with its own defaults would need the same treatment).
 */
const required = (object: z.ZodObject) =>
  z.object(
    Object.fromEntries(
      Object.entries(object.shape).map(([key, field]) => [
        key,
        field instanceof z.ZodDefault ? field.unwrap() : field,
      ]),
    ),
  );

// Widened to ZodObject: TS can't call .omit/.extend on the union of the six item schemas.
const itemSchema = (section: ListSection) =>
  required(cvContentSchema.shape[section].unwrap().element as z.ZodObject);

/**
 * CvContent as the model reads and writes it. Entry ids are ours: left out when structuring a new
 * CV, kept (optional) when changing an existing one, so every change can be traced to its entry.
 */
export const modelContentSchema = (ids: "omit" | "keep") =>
  required(cvContentSchema).extend(
    Object.fromEntries(
      LIST_SECTIONS.map((section) => [
        section,
        z.array(
          ids === "omit"
            ? itemSchema(section).omit({ id: true })
            : itemSchema(section).extend({ id: z.string().optional() }),
        ),
      ]),
    ),
  );

export const idsOf = (content: CvContent) =>
  new Set(
    LIST_SECTIONS.flatMap((s) =>
      (content[s] as { id: string }[]).map((e) => e.id),
    ),
  );

/**
 * Gives every entry an id: the model's, if it's one we know and not used yet, else a new one
 * (an entry the model added). Never trusts an id the model made up or repeated.
 */
export function withIds(
  parsed: object,
  known: Set<string> = new Set(),
): CvContent {
  const used = new Set<string>();
  const sections = parsed as Record<ListSection, { id?: string }[]>;
  return cvContentSchema.parse({
    ...parsed,
    ...Object.fromEntries(
      LIST_SECTIONS.map((section) => [
        section,
        sections[section].map((entry) => {
          const id =
            entry.id && known.has(entry.id) && !used.has(entry.id)
              ? entry.id
              : shortId();
          used.add(id);
          return { ...entry, id };
        }),
      ]),
    ),
  });
}

/** For prompts that change a CV's wording. */
export const EMPHASIS_RULE =
  "Highlights and other list items may mark words with **bold** or *italic* (markdown). Keep the markers around the same words when you keep or rephrase them, and add no new ones.";

/** Shared by every prompt that receives a CV. */
export const PLACEHOLDER_RULE =
  "Personal details were replaced with placeholders such as {{NAME}} or {{URL_2}}. Keep a placeholder exactly as written where it belongs; never guess what it stands for.";

/** What a good CV does, for reviewing and revising one. Read for the candidate's field. */
/** The user's review checklist, as the prompt states it: one rule per line, named. */
export const cvPractice = (rules: ChecklistRule[]) =>
  [
    "Good CV practice, read for the candidate's field (judge it from the headline and roles):",
    ...rules.map((r) => `- ${r.name}: ${r.text}`),
  ].join("\n");

/** For prompts that may only change wording, never facts. */
export const NO_NEW_FACTS_RULE =
  "Never add anything the CV doesn't already contain: employers, job titles, dates, degrees, schools, certifications, skills, tools, numbers or achievements. Never change those facts, and never overstate them: taking part doesn't become leading, and a team's work doesn't become the candidate's alone.";

/** On a variant: the job's requirements the CV matches, so a rewrite doesn't lose them. */
export const keepTermsRule = (terms: string[]) =>
  terms.length
    ? `\nThe CV was tailored to a job. Keep these terms wherever they appear, and never suggest removing them: ${terms.join(", ")}.`
    : "";
