import { cvText, digits, filled, normalize } from "./format";
import {
  type Changes,
  type CvContent,
  LIST_SECTIONS,
  type ListSection,
} from "./schema";

/** What was there before each change, keyed as described on `changesSchema`. */
type Original = Changes["original"];
type Entry = { id: string } & Record<string, unknown>;
type Field = "headline" | "summary" | ListSection;

export const entryKey = (section: ListSection, id: string) =>
  `${section}.${id}`;
export const orderKey = (section: ListSection) => `${section}.order`;
export const NO_CHANGES: Changes = { original: {}, flags: [] };

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const entries = (content: CvContent, section: ListSection) =>
  content[section] as Entry[];
const fieldOf = (key: string) => key.split(".")[0] as Field;

/** Whether an entry was added or changed (or neither), for its badge in the editor. */
export function changeKind(
  original: Original,
  section: ListSection,
  id: string,
) {
  const key = entryKey(section, id);
  if (!(key in original)) return undefined;
  return original[key] === null ? "added" : "changed";
}

/** Records, per field and per list entry, what `after` changed compared with `before`. */
export function diffContent(before: CvContent, after: CvContent): Original {
  const original: Original = {};
  for (const field of ["headline", "summary"] as const)
    if (before[field] !== after[field]) original[field] = before[field];

  for (const section of LIST_SECTIONS) {
    const prev = entries(before, section);
    const next = entries(after, section);
    const prevById = new Map(prev.map((e) => [e.id, e]));
    const nextIds = new Set(next.map((e) => e.id));
    for (const e of next) {
      const old = prevById.get(e.id);
      if (!old)
        original[entryKey(section, e.id)] = null; // added
      else if (!same(old, e)) original[entryKey(section, e.id)] = old; // changed
    }
    for (const e of prev)
      if (!nextIds.has(e.id)) original[entryKey(section, e.id)] = e; // removed
    const keptBefore = prev.map((e) => e.id).filter((id) => nextIds.has(id));
    const keptAfter = next.map((e) => e.id).filter((id) => prevById.has(id));
    if (!same(keptBefore, keptAfter))
      original[orderKey(section)] = prev.map((e) => e.id);
  }
  return original;
}

/**
 * Facts the model must never invent, per section: names, titles, dates, degrees and skills.
 * Free text (summary, highlights, descriptions) is meant to be rephrased: only its numbers are checked.
 */
const FACT_FIELDS: Partial<Record<ListSection, string[]>> = {
  experience: ["role", "company", "start", "end"],
  education: ["degree", "institution", "start", "end"],
  skills: ["items"],
  projects: ["name", "link"],
  languages: ["name", "level"],
};
/** Facts that stay the same in any language; the only ones checked when a CV was translated. */
const LANGUAGE_NEUTRAL = new Set([
  "company",
  "institution",
  "start",
  "end",
  "link",
  "items",
]);
const TEXT_FIELDS: Partial<Record<ListSection, string[]>> = {
  experience: ["highlights"],
  education: ["details"],
  projects: ["description"],
  extras: ["items"],
};
const factValues = (entry: Entry, field: string) =>
  filled([entry[field]].flat() as string[]);

/** A number with the word after it ("3 teams", "40%"), so a warning says what it counts. */
// Not part of a name like "S3", "EC2" or "IPv6".
const NUMBER = /(?<![\p{L}\d])\d+(?:[.,]\d+)*%?(?:\s+\p{L}+)?/gu;
const numbersIn = (texts: string[]) =>
  texts.flatMap((t) => t.match(NUMBER) ?? []);

/**
 * Local check (no LLM): facts in changed or added entries that appear in none of the `known`
 * versions (the base CV, and what the user had before this round, including anything they kept)
 * and not among `knownSkills` (skills the user confirmed in the match report), plus numbers in
 * changed text that none of the `known` versions contains.
 * Each flag points at the change it belongs to, so the editor can offer Revert or Keep.
 */
export function findFabrications(
  known: CvContent[],
  variant: CvContent,
  original: Original,
  {
    translated = false,
    knownSkills = [] as string[],
    stated = "",
  }: { translated?: boolean; knownSkills?: string[]; stated?: string } = {},
): Changes["flags"] {
  // Compared by digits only: "1,500" and "1.500" are the same number.
  const knownNumbers = new Set(
    numbersIn([...known.map(cvText), stated]).map(digits),
  );
  const userStated = normalize(stated);
  const newNumbers = (texts: string[]) =>
    numbersIn(texts).filter((n) => !knownNumbers.has(digits(n)));

  const flags: Changes["flags"] = [];
  for (const field of ["headline", "summary"] as const) {
    const facts = field in original ? newNumbers([variant[field]]) : [];
    if (facts.length) flags.push({ key: field, facts });
  }
  for (const section of LIST_SECTIONS) {
    const allFields = FACT_FIELDS[section] ?? [];
    const fields = translated
      ? allFields.filter((f) => LANGUAGE_NEUTRAL.has(f))
      : allFields;
    const seen = new Map(
      fields.map((f) => [
        f,
        new Set([
          ...known.flatMap((c) =>
            entries(c, section).flatMap((e) => factValues(e, f).map(normalize)),
          ),
          ...(section === "skills" ? knownSkills.map(normalize) : []),
        ]),
      ]),
    );
    for (const entry of entries(variant, section)) {
      const key = entryKey(section, entry.id);
      if (!(key in original)) continue;
      const facts = [
        ...fields.flatMap((f) =>
          factValues(entry, f).filter(
            (v) =>
              !seen.get(f)!.has(normalize(v)) &&
              !(userStated && userStated.includes(normalize(v))),
          ),
        ),
        ...newNumbers(
          (TEXT_FIELDS[section] ?? []).flatMap((f) => factValues(entry, f)),
        ),
      ];
      if (facts.length) flags.push({ key, facts });
    }
  }
  return flags;
}

/**
 * Adds what `after` changed (compared with `before`) to the tracked changes. Earlier originals win,
 * so after several rounds (tailor, then tighten) Revert still goes back to the earliest version.
 * Possible fabrications: facts in neither the base CV nor `before`, so anything the user kept
 * stays kept, skills the user confirmed, and anything the user `stated` in their own instruction. When `after` is in another language than the base, only
 * language-neutral facts count.
 */
export function recordChanges(
  previous: Changes,
  before: CvContent,
  after: CvContent,
  base: CvContent,
  {
    translated = false,
    knownSkills = [] as string[],
    stated = "",
  }: { translated?: boolean; knownSkills?: string[]; stated?: string } = {},
): Changes {
  const added = diffContent(before, after);
  const found = findFabrications([base, before], after, added, {
    translated,
    knownSkills,
    stated,
  });
  // A change already flagged keeps its flag and gains any new facts (e.g. a number a review added).
  const flags = previous.flags.map((g) => {
    const more = found.find((f) => f.key === g.key)?.facts ?? [];
    return { key: g.key, facts: [...new Set([...g.facts, ...more])] };
  });
  return {
    original: { ...added, ...previous.original },
    flags: [
      ...flags,
      ...found.filter((f) => !previous.flags.some((g) => g.key === f.key)),
    ],
  };
}

/** Accepts a change: it stops being tracked, and so does its fabrication flag. */
export function keepChange(changes: Changes, key: string): Changes {
  const original = { ...changes.original };
  delete original[key];
  return { original, flags: changes.flags.filter((f) => f.key !== key) };
}

/** Undoes one change. Returns the new content, the field it touched, and the remaining changes. */
export function revertChange(
  content: CvContent,
  changes: Changes,
  key: string,
): { content: CvContent; field: Field; changes: Changes } {
  const previous = changes.original[key];
  const field = fieldOf(key);
  const id = key.slice(field.length + 1);
  const remaining = keepChange(changes, key);
  if (field === "headline" || field === "summary")
    return {
      content: { ...content, [field]: previous as string },
      field,
      changes: remaining,
    };

  const list = entries(content, field);
  let next: Entry[];
  if (id === "order") {
    const order = previous as string[];
    const rank = (e: Entry) =>
      order.includes(e.id) ? order.indexOf(e.id) : order.length;
    next = [...list].sort((a, b) => rank(a) - rank(b));
  } else if (previous === null) {
    next = list.filter((e) => e.id !== id); // was added: remove it
  } else if (list.some((e) => e.id === id)) {
    next = list.map((e) => (e.id === id ? (previous as Entry) : e)); // was changed: restore it
  } else {
    next = [...list, previous as Entry]; // was removed: bring it back (at the end; "Move up" to place it)
  }
  return { content: { ...content, [field]: next }, field, changes: remaining };
}

/** Undoes every change: entries first, then their order. */
export function revertAll(content: CvContent, changes: Changes): CvContent {
  const keys = Object.keys(changes.original).sort(
    (a, b) => Number(a.endsWith(".order")) - Number(b.endsWith(".order")),
  );
  return keys.reduce(
    (state, key) => revertChange(state.content, state.changes, key),
    { content, changes },
  ).content;
}
