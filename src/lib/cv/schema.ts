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

export const TEMPLATE_IDS = ["classic", "sidebar", "modern"] as const;
const templateSchema = z.enum(TEMPLATE_IDS);

export const cvIdSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
export const pagesSchema = z.union([z.literal(1), z.literal(2)]);

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
  company: z
    .string()
    .describe("The hiring company, as the posting names it, or empty"),
  language: z
    .string()
    .describe("ISO 639-1 code of the job posting's language, e.g. en, de, pt"),
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

/**
 * One finding of a review. It lives in the Review panel; the ones only the candidate can act on are
 * also kept on the CV as to-dos. No defaults, like `analysisSchema`: the model writes every field.
 */
export const suggestionSchema = z.object({
  area: z
    .enum(["headline", "summary", ...LIST_SECTIONS, "whole"])
    .describe(
      'The part of the CV it is about; "whole" for something across sections',
    ),
  entryId: z
    .string()
    .nullable()
    .describe("The id of the entry it is about, or null for a whole section"),
  problem: z.string().describe("What's wrong, quoting the words in question"),
  detail: z.string().describe("One sentence on how to fix it"),
  rule: z.string().describe("The name of the checklist rule it comes from"),
  kind: z
    .enum(["fix", "yours"])
    .describe(
      '"fix": can be fixed with what the CV already says. "yours": needs something only the candidate knows, such as a real number',
    ),
});
/** What needs the candidate's own input, kept on the CV as a note on its entry until marked done. */
export const todoSchema = suggestionSchema.omit({ kind: true });

/** One rule of the review checklist: a short name (shown as a tag on suggestions) and the rule itself. */
const checklistRuleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give every rule a short name.")
    .max(40, "Keep rule names under 40 characters."),
  text: z
    .string()
    .trim()
    .min(1, "A rule can't be empty.")
    .max(500, "Keep each rule under 500 characters."),
});

export const checklistRulesSchema = z
  .array(checklistRuleSchema)
  .min(1, "Keep at least one rule.")
  .max(15, "Keep the checklist to 15 rules.")
  .refine(
    (rules) => new Set(rules.map((r) => r.name)).size === rules.length,
    "Give each rule a different name.",
  );

/** The review checklist, saved once for the tool (`data/checklist.json`). */
export const checklistSchema = z.object({
  v: z.literal(1),
  rules: checklistRulesSchema,
});

/** The analysis a variant was tailored from, with the gaps the user confirmed. */
// The company is kept on the job, and the language only decides whether the panel offers to translate.
const matchReportSchema = analysisSchema
  .omit({ company: true, language: true })
  .extend({
    /** Tailoring may add these, and they aren't flagged as possible fabrications. */
    confirmed: z.array(z.string()),
    createdAt: z.iso.datetime(),
  });

const jobSchema = z.object({
  title: text,
  company: text,
  url: text,
  text: text,
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

/** One call to the model: which model ran, what the provider charged (null if it doesn't say) and the tokens used. */
const runSchema = z.object({
  model: z.string(),
  costUsd: z.number().nonnegative().nullable(),
  tokens: z.number().int().nonnegative(),
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
  template: templateSchema.default("classic"),
  /** This CV's own contact details. Never part of `content`, so never sent to an LLM. */
  contact: contactSchema.prefault({}),
  /** Values masked when this CV was imported (custom masks, extra emails…); see `privateValuesOf`. */
  vault: listOf(privateValueSchema),
  content: cvContentSchema,
  /** The job offer a variant was tailored to. */
  job: jobSchema.nullable().default(null),
  /** What tailoring, a review or "Tighten to fit" changed, until the user reverts or keeps each change. */
  changes: changesSchema.prefault({}),
  /** What the last review left for the candidate to do, shown on its entries until marked done. */
  todos: listOf(todoSchema),
  /** The last model call that changed this CV (import, tailoring or an edit), for its banner. */
  lastRun: runSchema.nullable().default(null),
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
  template: templateSchema,
  contact: contactSchema,
  content: cvContentSchema,
  changes: changesSchema,
});

export type Contact = z.infer<typeof contactSchema>;
export type TemplateId = z.infer<typeof templateSchema>;
export type CvContent = z.infer<typeof cvContentSchema>;
export type CvRecord = z.infer<typeof cvRecordSchema>;
export type EditorValues = z.infer<typeof editorValuesSchema>;
export type PrivateValue = z.infer<typeof privateValueSchema>;
export type ImportDraft = z.infer<typeof importDraftSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Changes = z.infer<typeof changesSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type MatchReport = z.infer<typeof matchReportSchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
export type Run = z.infer<typeof runSchema>;
export type Todo = z.infer<typeof todoSchema>;
export type ChecklistRule = z.infer<typeof checklistRuleSchema>;
/** A CV as templates render it and the match score reads it. */
export type CvView = Pick<EditorValues, "contact" | "content" | "template">;
