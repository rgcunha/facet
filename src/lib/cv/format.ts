/** Trimmed, non-empty values only. Editors keep raw text (so an empty entry can be typed into); display filters here. */
export const filled = (values: string[]) =>
  values.map((v) => v.trim()).filter(Boolean);

export const joinFilled = (values: string[], separator = " · ") =>
  filled(values).join(separator);

export const range = (start: string, end: string) =>
  joinFilled([start, end], " – ");

/** True when an entry has no visible content (its id doesn't count), e.g. one just added and left empty. */
const isBlank = (entry: object) =>
  Object.entries(entry).every(
    ([key, value]) =>
      key === "id" ||
      (Array.isArray(value)
        ? filled(value).length === 0
        : !String(value).trim()),
  );

export const visible = <T extends object>(entries: T[]) =>
  entries.filter((entry) => !isBlank(entry));

export const plural = (n: number, word: string) =>
  `${n} ${word}${n === 1 ? "" : "s"}`;
