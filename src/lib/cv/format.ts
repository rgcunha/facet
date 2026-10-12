import {
  type CvContent,
  LIST_SECTIONS,
  type ListSection,
  type Run,
} from "./schema";

/** Trimmed, non-empty values only. Editors keep raw text (so an empty entry can be typed into); display filters here. */
export const filled = (values: string[]) =>
  values.map((v) => v.trim()).filter(Boolean);

export const joinFilled = (values: string[], separator = " · ") =>
  filled(values).join(separator);

export const range = (start: string, end: string) =>
  joinFilled([start, end], " – ");

/** Lower case without accents ("Março" → "marco"), for matching words written either way. */
export const fold = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** For comparing values typed or extracted differently: case and whitespace don't count. */
export const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

/** Every non-empty text in a list entry (its id excluded), e.g. to show a whole entry that was added or removed. */
export const entryValues = (entry: object) =>
  filled(
    Object.entries(entry).flatMap(([key, value]) =>
      key === "id" ? [] : ([value].flat() as string[]),
    ),
  );

/** What an entry is called in a heading: its employer, school, project, group or section title. */
export const entryName = (entry: Record<string, unknown>) =>
  joinFilled(
    ["company", "institution", "name", "group", "title"].map((key) =>
      String(entry[key] ?? ""),
    ),
  );

/** True when an entry has no visible content, e.g. one just added and left empty. */
const isBlank = (entry: object) => entryValues(entry).length === 0;

export const visible = <T extends object>(entries: T[]) =>
  entries.filter((entry) => !isBlank(entry));

export const plural = (n: number, word: string, many = `${word}s`) =>
  `${n} ${n === 1 ? word : many}`;

/** The list with `item` added, or removed if it was there: a ticked or unticked checkbox. */
export const toggled = <T>(list: T[], item: T) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export const digits = (s: string) => s.replace(/\D/g, "");

/** What a model call cost ("$0.004", "$0.07"), or its tokens ("8.4k tokens") when the provider doesn't say. */
export function runCost({ costUsd, tokens }: Run) {
  if (costUsd === null)
    return `${tokens < 1000 ? tokens : `${(tokens / 1000).toFixed(1)}k`} tokens`;
  if (costUsd < 0.001) return "under $0.001";
  return `$${costUsd.toFixed(costUsd < 0.01 ? 3 : 2)}`;
}

/**
 * Inline emphasis in a list item: "**bold**" and "*italic*", the markdown people already type.
 * As in CommonMark, a marker only opens after a space or punctuation and only closes before one,
 * so asterisks in "5* rating", "2 * 3", "*nix/*BSD" or "*.ts" stay plain text.
 */
const EMPHASIS =
  /((?<![\p{L}\p{N}*])\*\*(?=[^\s*])[^*\n]+?(?<=[^\s*])\*\*(?![\p{L}\p{N}*])|(?<![\p{L}\p{N}*/])\*(?=[\p{L}\p{N}])[^*\n]*?(?<=[^\s*])\*(?![\p{L}\p{N}*]))/u;

export function emphasis(text: string) {
  return text
    .split(EMPHASIS)
    .map((part, i) => {
      if (i % 2 === 0) return { text: part, style: null };
      return part.startsWith("**")
        ? { text: part.slice(2, -2), style: "bold" as const }
        : { text: part.slice(1, -1), style: "italic" as const };
    })
    .filter((part) => part.text);
}

/** Every text of a CV (ids excluded), for searching it as a whole. */
export const cvText = (content: CvContent) =>
  [
    content.headline,
    content.summary,
    ...LIST_SECTIONS.flatMap((s) => content[s].flatMap(entryValues)),
  ].join("\n");

/** What the editor calls each list section; review headings use the same words. */
export const SECTION_TITLES: Record<ListSection, string> = {
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  languages: "Languages",
  extras: "Other sections",
};
