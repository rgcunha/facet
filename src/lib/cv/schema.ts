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

/** A personal detail that must never reach an LLM provider. */
export const privateValueSchema = z.object({
  kind: z.enum(["name", "email", "phone", "address", "url", "dob", "custom"]),
  value: z.string().min(1),
});

export const cvIdSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const pagesSchema = z.union([z.literal(1), z.literal(2)]);

/** A requirement of a job, with the other words a CV may use for it ("k8s" for Kubernetes). */
const requirementSchema = z.object({
  name: z.string(),
  synonyms: z.array(z.string()),
  priority: z.enum(["must", "nice"]),
});

/**
 * How a CV matches a job, as analysis returns it. No defaults: every field is written by the model,
 * and the model must see every field as required (see `required` in lib/llm/content.ts).
 */
export const analysisSchema = z.object({
  title: z.string().describe("The job title, as the posting names it"),
  yearsRequired: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("Years of experience the posting asks for, or null"),
  requirements: z.array(requirementSchema),
  strengths: z.array(z.string()),
  /** Requirements the CV suggests but doesn't show; the user confirms the true ones. */
  gaps: z.array(z.object({ name: z.string(), why: z.string() })),
  /** Requirements the CV gives no sign of. Never added. */
  missing: z.array(z.string()),
  suggestions: z.array(z.string()),
});

/** The analysis a variant was tailored from, with the gaps the user confirmed. */
const matchReportSchema = analysisSchema.extend({
  /** Tailoring may add these, and they aren't flagged as possible fabrications. */
  confirmed: z.array(z.string()),
  createdAt: z.iso.datetime(),
});

const jobSchema = z.object({
  title: text,
  company: text,
  url: text,
  text: text,
  language: text,
  /** The match report the variant was tailored from. */
  report: matchReportSchema.nullable().default(null),
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
  /** This CV's own contact details. Never part of `content`, so never sent to an LLM. */
  contact: contactSchema.prefault({}),
  /** Values masked when this CV was imported (custom masks, extra emails…); see `privateValuesOf`. */
  vault: listOf(privateValueSchema),
  content: cvContentSchema,
  /** The job offer a variant was tailored to. */
  job: jobSchema.nullable().default(null),
  /** What tailoring or "Tighten to fit" changed, until the user reverts or keeps each change. */
  changes: changesSchema.prefault({}),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
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
export type EditorValues = z.infer<typeof editorValuesSchema>;
export type PrivateValue = z.infer<typeof privateValueSchema>;
export type ImportDraft = z.infer<typeof importDraftSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Changes = z.infer<typeof changesSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type MatchReport = z.infer<typeof matchReportSchema>;
