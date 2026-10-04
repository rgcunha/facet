import {
  cvContentSchema,
  customSectionSchema,
  educationSchema,
  experienceSchema,
  languageSchema,
  profileSchema,
  projectSchema,
  skillGroupSchema,
} from "./schema";

export const UNTITLED_CV = "Untitled CV";

export const shortId = () => crypto.randomUUID().slice(0, 8);

export const emptyProfile = () => profileSchema.parse({ v: 1, contact: {} });

export const emptyContent = () => cvContentSchema.parse({});

/** Blank entries the editor adds via "Add …". A role and a custom section start with one empty line to type into. */
export const blankItem = {
  experience: () => experienceSchema.parse({ id: shortId(), highlights: [""] }),
  education: () => educationSchema.parse({ id: shortId() }),
  skills: () => skillGroupSchema.parse({ id: shortId() }),
  projects: () => projectSchema.parse({ id: shortId() }),
  languages: () => languageSchema.parse({ id: shortId() }),
  extras: () => customSectionSchema.parse({ id: shortId(), items: [""] }),
};
