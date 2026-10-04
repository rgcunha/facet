import { normalize } from "@/lib/cv/format";
import type { PrivateValue } from "@/lib/cv/schema";

/** A private value and the placeholder that replaces it in text sent to an LLM, e.g. {{EMAIL}}. */
export type Mask = PrivateValue & { token: string };

/** Matches a placeholder produced by `toMasks`, e.g. {{EMAIL}} or {{URL_2}}. */
export const TOKEN_PATTERN = /(\{\{[A-Z]+(?:_\d+)?\}\})/;

/** Two private values are the same if they differ only in case or whitespace. */
export const sameValue = (a: string, b: string) =>
  normalize(a) === normalize(b);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Stable placeholders: the first of each kind is {{EMAIL}}, further ones {{EMAIL_2}}, {{EMAIL_3}}… */
export function toMasks(values: PrivateValue[]): Mask[] {
  const seen = new Map<string, number>();
  return values.map((v) => {
    const n = (seen.get(v.kind) ?? 0) + 1;
    seen.set(v.kind, n);
    const kind = v.kind.toUpperCase();
    return { ...v, token: `{{${n === 1 ? kind : `${kind}_${n}`}}}` };
  });
}

/**
 * How a value may appear in text: words with any whitespace between them, and for numbers
 * (phones) the same digits with any common separators ("+351 912-345-678", "00351912345678").
 */
function patternFor(value: string) {
  const digits = value.replace(/\D/g, "");
  if (
    digits.length >= 7 &&
    digits.length >= value.replace(/\s/g, "").length - 2
  )
    return digits.split("").join("[\\s().\\/-]*");
  return value.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
}

/** Replaces every occurrence of each value (any case, any formatting, see `patternFor`) with its token. */
export function redact(text: string, masks: Mask[]) {
  return [...masks]
    .sort((a, b) => b.value.length - a.value.length)
    .reduce(
      (out, m) => out.replace(new RegExp(patternFor(m.value), "giu"), m.token),
      text,
    );
}

/** Puts the real values back wherever the model kept a token, in every string of a JSON-like value. */
export function rehydrate<T>(data: T, masks: Mask[]): T {
  const restore = (s: string) =>
    masks.reduce((out, m) => out.replaceAll(m.token, m.value), s);
  const walk = (v: unknown): unknown =>
    typeof v === "string"
      ? restore(v)
      : Array.isArray(v)
        ? v.map(walk)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
          : v;
  return walk(data) as T;
}
