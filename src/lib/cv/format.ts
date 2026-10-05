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

/** Every non-empty text in a list entry (its id excluded), e.g. to show what an entry was. */
export const entryValues = (entry: object) =>
  filled(
    Object.entries(entry).flatMap(([key, value]) =>
      key === "id" ? [] : ([value].flat() as string[]),
    ),
  );

/** True when an entry has no visible content, e.g. one just added and left empty. */
const isBlank = (entry: object) => entryValues(entry).length === 0;

export const visible = <T extends object>(entries: T[]) =>
  entries.filter((entry) => !isBlank(entry));

export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;
