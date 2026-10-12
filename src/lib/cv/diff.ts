import { type Entry, entryKey, parseChangeKey, same } from "./changes";
import { entryName, entryValues, plural, SECTION_TITLES } from "./format";
import {
  type Changes,
  type CvContent,
  LIST_SECTIONS,
  type ListSection,
} from "./schema";

/** A run of words that both versions share, or that only the new or only the old one has. */
export type Part = { text: string; kind: "same" | "added" | "removed" };
/** One line of a change's card: a field or bullet, with what changed in it. */
type Line = { label: string; parts: Part[] };
export type ChangeView = { where: string; note: string; lines: Line[] };

const words = (s: string) => s.match(/\S+/g) ?? [];

/** Word-level diff of two texts (longest common subsequence; CV fields are short). */
export function diffWords(before: string, after: string): Part[] {
  const a = words(before);
  const b = words(after);
  // lcs[i][j]: length of the longest common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const parts: Part[] = [];
  const push = (word: string, kind: Part["kind"]) => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += ` ${word}`;
    else parts.push({ text: word, kind });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push(a[i++], "same");
      j++;
    } else if (
      // On a tie the old words go first, so a replacement reads "old → new".
      i < a.length &&
      (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])
    )
      push(a[i++], "removed");
    else push(b[j++], "added");
  }
  return parts;
}

const shared = (parts: Part[]) =>
  parts
    .filter((p) => p.kind === "same")
    .reduce((n, p) => n + words(p.text).length, 0);

/** A word diff, and whether the texts share enough (a third of the shorter one's words) for it to read well. */
function compare(before: string, after: string) {
  const parts = diffWords(before, after);
  const shorter = Math.max(
    1,
    Math.min(words(before).length, words(after).length),
  );
  const likeness = shared(parts) / shorter;
  return { parts, likeness, alike: likeness >= 1 / 3 };
}

/** Old text then new when they share too little for a word diff to read well (a translation, a rewrite from scratch). */
const replaced = (before: string, after: string): Part[] => [
  ...(before ? [{ text: before, kind: "removed" as const }] : []),
  ...(after ? [{ text: after, kind: "added" as const }] : []),
];

function textChange(before: string, after: string): Part[] {
  const { parts, alike } = compare(before, after);
  return alike ? parts : replaced(before, after);
}

/**
 * A list (bullets, skills) compared item by item: unchanged items are only counted; a rewritten item
 * is paired with the old one it is most like, so the card shows a word diff instead of a removal and
 * an addition.
 */
function listChange(label: string, before: string[], after: string[]) {
  const unchanged = after.filter((item) => before.includes(item));
  const gone = before.filter((item) => !after.includes(item));
  const lines: Line[] = [];
  after.forEach((item, n) => {
    if (before.includes(item)) return;
    let best: { old: string; parts: Part[]; likeness: number } | undefined;
    for (const old of gone) {
      const c = compare(old, item);
      if (c.alike && (!best || c.likeness > best.likeness))
        best = { old, ...c };
    }
    if (best) gone.splice(gone.indexOf(best.old), 1);
    lines.push({
      label: `${label} ${n + 1}`,
      parts: best?.parts ?? replaced("", item),
    });
  });
  for (const old of gone)
    lines.push({ label: `${label} removed`, parts: replaced(old, "") });
  const kept = before.filter((item) => after.includes(item));
  if (!same(kept, unchanged))
    lines.unshift({
      label: `${label}s reordered`,
      parts: [{ text: unchanged.join(" · "), kind: "same" }],
    });
  return { lines, unchanged: unchanged.length };
}

const FIELD_LABELS: Record<string, string> = {
  highlights: "Bullet",
  items: "Item",
  "skills.items": "Skill",
};
const fieldLabel = (section: ListSection, key: string) =>
  FIELD_LABELS[`${section}.${key}`] ??
  FIELD_LABELS[key] ??
  key[0].toUpperCase() + key.slice(1);

function entryChange(section: ListSection, before: Entry, after: Entry) {
  const lines: Line[] = [];
  const notes: string[] = [];
  for (const key of Object.keys(after)) {
    if (key === "id") continue;
    const [was, now] = [before[key], after[key]];
    if (same(was, now)) continue;
    const label = fieldLabel(section, key);
    if (Array.isArray(now)) {
      const list = listChange(label, (was as string[] | undefined) ?? [], now);
      lines.push(...list.lines);
      if (list.unchanged)
        notes.push(`${plural(list.unchanged, label.toLowerCase())} unchanged`);
    } else
      lines.push({ label, parts: textChange(String(was ?? ""), String(now)) });
  }
  return { lines, note: notes.join(", ") };
}

/** The whole entry as one kind of change, for one that was added or removed. */
const wholeEntry = (entry: Entry, kind: "added" | "removed"): Line[] =>
  entryValues(entry).map((text) => ({ label: "", parts: [{ text, kind }] }));

/** What a change's card shows: where it is, and per field or bullet, what changed. */
export function describeChange(
  key: string,
  original: Changes["original"],
  content: CvContent,
): ChangeView {
  const previous = original[key];
  const { field, id } = parseChangeKey(key);
  if (field === "headline" || field === "summary")
    return {
      where: field === "headline" ? "Headline" : "Summary",
      note: "",
      lines: [
        {
          label: "",
          parts: textChange(String(previous ?? ""), content[field]),
        },
      ],
    };

  const list = content[field] as Entry[];
  const title = SECTION_TITLES[field];
  // An entry as it is now, or as it was if it has been removed since.
  const find = (entryId: string) =>
    list.find((e) => e.id === entryId) ??
    (original[entryKey(field, entryId)] as Entry | null | undefined);
  if (id === "order") {
    const names = (entries: (Entry | null | undefined)[]) =>
      entries.map((e) => (e && entryName(e)) || "Untitled").join(" · ");
    return {
      where: `${title} · order`,
      note: "",
      lines: [
        {
          label: "Was",
          parts: [
            { text: names((previous as string[]).map(find)), kind: "removed" },
          ],
        },
        { label: "Now", parts: [{ text: names(list), kind: "added" }] },
      ],
    };
  }

  const now = list.find((e) => e.id === id);
  const was = previous as Entry | null;
  const name = (now ?? was) ? entryName((now ?? was)!) : "";
  const where = name ? `${title} · ${name}` : title;
  if (!was && !now) return { where, note: "Added, then removed", lines: [] };
  if (!was) return { where, note: "Added", lines: wholeEntry(now!, "added") };
  if (!now)
    return { where, note: "Removed", lines: wholeEntry(was, "removed") };
  const change = entryChange(field, was, now);
  return change.lines.length
    ? { where, ...change }
    : { where, note: "Edited back to what it was", lines: [] };
}

/** Cards in the order of the CV: headline, summary, then each section's entries before its order. */
export function changeOrder(keys: string[]) {
  const rank = (key: string) => {
    const { field, id } = parseChangeKey(key);
    if (field === "headline") return 0;
    if (field === "summary") return 1;
    return 2 + LIST_SECTIONS.indexOf(field) * 2 + Number(id === "order");
  };
  return [...keys].sort((a, b) => rank(a) - rank(b));
}
