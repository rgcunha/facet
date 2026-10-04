import { z } from "zod";

// Leaf defaults make the schema the single source of empty values (see empty.ts),
// and let fields added later be read from older files without a migration.
const id = z.string().min(1);
const text = z.string().default("");
const texts = z.array(z.string()).default([]);
const listOf = <T extends z.ZodType>(item: T) => z.array(item).default([]);

const contactSchema = z.object({
  name: text,
  email: text,
  phone: text,
  location: text,
  dateOfBirth: text,
  links: texts,
});

export const experienceSchema = z.object({
  id,
  role: text,
  company: text,
  location: text,
  start: text,
  end: text,
  highlights: texts,
});

export const educationSchema = z.object({
  id,
  degree: text,
  institution: text,
  location: text,
  start: text,
  end: text,
  details: text,
});

export const skillGroupSchema = z.object({ id, group: text, items: texts });

export const projectSchema = z.object({
  id,
  name: text,
  link: text,
  description: text,
});

export const languageSchema = z.object({ id, name: text, level: text });

export const customSectionSchema = z.object({ id, title: text, items: texts });

/** Everything in a CV except contact details: the only part that may ever be sent to an LLM. */
export const cvContentSchema = z.object({
  headline: text,
  summary: text,
  experience: listOf(experienceSchema),
  education: listOf(educationSchema),
  skills: listOf(skillGroupSchema),
  projects: listOf(projectSchema),
  languages: listOf(languageSchema),
  extras: listOf(customSectionSchema),
});

/** The list sections of a CV, in display order. Their entries carry an `id`. */
export const LIST_SECTIONS = [
  "experience",
  "education",
  "skills",
  "projects",
  "languages",
  "extras",
] as const;
export type ListSection = (typeof LIST_SECTIONS)[number];

export const cvIdSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const pagesSchema = z.union([z.literal(1), z.literal(2)]);

const jobSchema = z.object({
  title: text,
  company: text,
  url: text,
  text: text,
  language: text,
  /** Requirements of the job that the CV doesn't show; the user adds them only if true. */
  missingKeywords: texts,
});

/**
 * Keys: "headline", "summary", "<section>.<entryId>" (an entry changed, added or removed) and
 * "<section>.order" (entries reordered). Values: what was there before (null for an added entry).
 */
const changesSchema = z.object({
  original: z.record(z.string(), z.unknown()).default({}),
  /** Facts in a changed entry that the base CV doesn't contain: possible fabrication. */
  flags: listOf(z.object({ key: z.string(), facts: z.array(z.string()) })),
});

export const cvRecordSchema = z.object({
  v: z.literal(1),
  id: cvIdSchema,
  kind: z.enum(["base", "variant"]),
  title: z.string(),
  baseId: cvIdSchema.nullable(),
  /** Id of the original PDF in data/sources/, for CVs created by import. */
  sourcePdf: cvIdSchema.nullable().default(null),
  language: z.string(),
  pages: pagesSchema,
  content: cvContentSchema,
  /** The job offer a variant was tailored to. */
  job: jobSchema.nullable().default(null),
  /** What tailoring or "Tighten to fit" changed, until the user reverts or keeps each change. */
  changes: changesSchema.prefault({}),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** A personal detail that must never reach an LLM provider. */
export const privateValueSchema = z.object({
  kind: z.enum(["name", "email", "phone", "address", "url", "dob", "custom"]),
  value: z.string().min(1),
});

export const profileSchema = z.object({
  v: z.literal(1),
  contact: contactSchema,
  /** Every value masked in an import; outgoing LLM requests are masked and checked against these. */
  vault: listOf(privateValueSchema),
});

/** An uploaded PDF waiting for review on the Import screen. Holds raw text, so it stays local. */
export const importDraftSchema = z.object({
  v: z.literal(1),
  id: cvIdSchema,
  fileName: z.string(),
  pageCount: z.number().int().positive(),
  text: z.string(),
  detected: z.array(privateValueSchema),
});

/** What the editor form edits and autosaves. */
export const editorValuesSchema = z.object({
  title: z.string(),
  pages: pagesSchema,
  contact: contactSchema,
  content: cvContentSchema,
  changes: changesSchema,
});

export type Contact = z.infer<typeof contactSchema>;
export type CvContent = z.infer<typeof cvContentSchema>;
export type CvRecord = z.infer<typeof cvRecordSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type EditorValues = z.infer<typeof editorValuesSchema>;
export type PrivateValue = z.infer<typeof privateValueSchema>;
export type ImportDraft = z.infer<typeof importDraftSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Changes = z.infer<typeof changesSchema>;
