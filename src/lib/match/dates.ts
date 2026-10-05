import { fold } from "@/lib/cv/format";

const MONTHS = [
  "jan",
  "feb|fev",
  "mar|mrz",
  "apr|abr|avr",
  "may|mai",
  "jun",
  "jul",
  "aug|ago",
  "sep|set",
  "oct|okt|out",
  "nov",
  "dec|dez|dic",
].map((names) => new RegExp(`\\b(?:${names})`));
// Whole words, so "atual" must also be spelled out as "atualmente" (pt) and "actualidad" (es).
const PRESENT =
  /\b(?:present|current(?:ly)?|now|today|ongoing|heute|aktuell|jetzt|atual(?:mente)?|actual(?:mente|idad)?|presente|hoje|aujourd'hui)\b/;

/** A date as CVs write it ("03/2019", "Jan 2025", "2021", "Present"), as a month count; null if unreadable. */
export function parseDate(text: string, now = new Date()) {
  const s = fold(text);
  if (PRESENT.test(s))
    return { months: now.getFullYear() * 12 + now.getMonth(), hasMonth: true };
  const year = s.match(/\b(?:19|20)\d{2}\b/);
  if (!year) return null;
  // "03/2019" or year first, "2019-03"
  const numeric =
    s.match(/\b(\d{1,2})\s*[./-]\s*(?:19|20)\d{2}\b/) ??
    s.match(/\b(?:19|20)\d{2}\s*[./-]\s*(\d{1,2})\b/);
  const month = numeric
    ? Number(numeric[1]) - 1
    : MONTHS.findIndex((m) => m.test(s));
  const hasMonth = month >= 0 && month <= 11;
  return { months: Number(year[0]) * 12 + (hasMonth ? month : 0), hasMonth };
}
