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

export const cvIdSchema = z.string().regex(/^[a-z0-9-]{1,80}$/);
const pagesSchema = z.union([z.literal(1), z.literal(2)]);

export const cvRecordSchema = z.object({
  v: z.literal(1),
  id: cvIdSchema,
  kind: z.enum(["base", "variant"]),
  title: z.string(),
  baseId: cvIdSchema.nullable(),
  language: z.string(),
  pages: pagesSchema,
  content: cvContentSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const profileSchema = z.object({
  v: z.literal(1),
  contact: contactSchema,
});

/** What the editor form edits and autosaves. */
export const editorValuesSchema = z.object({
  title: z.string(),
  pages: pagesSchema,
  contact: contactSchema,
  content: cvContentSchema,
});

export type Contact = z.infer<typeof contactSchema>;
export type CvContent = z.infer<typeof cvContentSchema>;
export type CvRecord = z.infer<typeof cvRecordSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type EditorValues = z.infer<typeof editorValuesSchema>;
