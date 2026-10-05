import type { PrivateValue } from "@/lib/cv/schema";
import type { TextLine } from "@/lib/pdf/extract";
import { sameValue } from "./redact";

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
const URL =
  /\b(?:https?:\/\/|www\.)[^\s,;·|•]+|\b(?:linkedin\.com|github\.com|gitlab\.com|xing\.com|behance\.net|dribbble\.com|medium\.com|stackoverflow\.com)\/[^\s,;·|•]+/gi;
const PHONE = /(?:\+|\b00)?\d[\d ().\/-]{6,}\d/g;
// "2017 - 2021", "03/2019 - 05/2021", "03.2019–05.2021": date ranges, not phone numbers.
const DATE_RANGE =
  /^(?:\d{1,2}[./])?(?:19|20)\d{2}\s*[-–/]\s*(?:\d{1,2}[./])?(?:19|20)\d{2}$/;
const DATE =
  /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\.?\s+\p{L}{3,}\.?\s+(?:19|20)\d{2}\b|\b\p{L}{3,}\.?\s+\d{1,2},?\s+(?:19|20)\d{2}\b/u;
const BIRTH =
  /\b(?:birth|born|d\.?o\.?b|geboren|geburtsdatum|geb\.|nascimento|nascido|nacimiento|naissance)\b/i;
// German street names end in the keyword ("Hauptstraße"), and \b doesn't treat ß as a letter.
const STREET =
  /(?:str\.|straße|strasse|weg|gasse|platz|allee)(?=[\s\d,]|$)|\b(?:rua|avenida|av\.|travessa|largo|street|road|avenue|lane|calle|rue)\b/iu;
const POSTCODE_CITY =
  /\b\d{4}(?:-\d{3})?\s+\p{Lu}[\p{L}-]+|\b\d{5}\s+\p{Lu}[\p{L}-]+/u;
const NAME = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{L}[\p{L}'’.-]*){1,4}$/u;
/** Contact details sit in the header; only these first lines are scanned for name, address and birth date. */
const HEADER_LINES = 12;
/** Separators people put between contact details on one line. */
const SEGMENT_SEPARATOR = /\s*[·|•]\s*|\s{3,}/;

const digits = (s: string) => s.replace(/\D/g, "");

const dateIn = (line?: TextLine) => line?.text.match(DATE)?.[0];

/** A full date whose year makes the person 16–80 years old: CV headers also hold other dates. */
function plausibleBirthDate(line: TextLine) {
  const date = dateIn(line);
  if (!date) return undefined;
  const year = Number(date.match(/(?:19|20)\d{2}/)?.[0]);
  const thisYear = new Date().getFullYear();
  return year >= thisYear - 80 && year <= thisYear - 16 ? date : undefined;
}

/** Labelled ("Born: 1990-03-12"), label on its own line, or no label at all. */
const birthDate = (header: TextLine[], i: number) =>
  BIRTH.test(header[i].text)
    ? (dateIn(header[i]) ?? dateIn(header[i + 1]))
    : plausibleBirthDate(header[i]);

function findName(header: TextLine[]) {
  const candidates = header.filter((l) => NAME.test(l.text.trim()));
  const largest = Math.max(...header.map((l) => l.size));
  return (
    candidates.find((l) => l.size === largest) ?? candidates[0]
  )?.text.trim();
}

/**
 * Finds personal details in CV text, locally and without any network call. It is deliberately
 * eager (a false positive costs the user one click to unmask) and the Import screen lets the user
 * mask anything it missed.
 */
export function detectPrivate(lines: TextLine[]): PrivateValue[] {
  const found: PrivateValue[] = [];
  const add = (kind: PrivateValue["kind"], value: string | undefined) => {
    const v = value?.trim().replace(/[.,;:)]+$/, "");
    if (v && !found.some((f) => sameValue(f.value, v)))
      found.push({ kind, value: v });
  };
  const text = lines.map((l) => l.text).join("\n");
  const header = lines.slice(0, HEADER_LINES);

  add("name", findName(header));
  for (const m of text.matchAll(EMAIL)) add("email", m[0]);
  for (const m of text.matchAll(URL)) if (!m[0].includes("@")) add("url", m[0]);
  for (const m of text.matchAll(PHONE)) {
    const n = digits(m[0]).length;
    if (n >= 9 && n <= 15 && !DATE_RANGE.test(m[0].trim()) && !DATE.test(m[0]))
      add("phone", m[0]);
  }
  for (const [i, line] of header.entries()) {
    add("dob", birthDate(header, i));
    for (const segment of line.text.split(SEGMENT_SEPARATOR)) {
      const s = segment.replace(EMAIL, "").replace(URL, "").trim();
      if ((STREET.test(s) && /\d/.test(s)) || POSTCODE_CITY.test(s))
        add("address", s);
    }
  }
  return found;
}
