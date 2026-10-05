import type { TemplateId } from "./schema";

/** What the app knows about each CV template besides its markup (in src/templates). */
export const TEMPLATE_INFO: Record<
  TemplateId,
  {
    name: string;
    description: string;
    /** ATS parsers read one column reliably; some mix up two. */
    singleColumn: boolean;
    /** Roughly, for "Tighten to fit": how many words one line of body text holds. */
    wordsPerLine: number;
  }
> = {
  classic: {
    name: "Classic",
    description: "Serif, one column.",
    singleColumn: true,
    wordsPerLine: 12,
  },
  sidebar: {
    name: "Sidebar",
    description: "Bold name; skills and education in a left column.",
    singleColumn: false,
    wordsPerLine: 8,
  },
  modern: {
    name: "Modern",
    description: "Sans-serif, one column, skills near the top.",
    singleColumn: true,
    wordsPerLine: 12,
  },
};
