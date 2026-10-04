import type { PrivateValue } from "@/lib/cv/schema";

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
/** Joins digit groups ("+351 912-000 000" → "351912000000") so reformatted numbers still match. */
const joinDigitGroups = (s: string) =>
  s.replace(/(?<=\d)[\s().\/-]+(?=\d)/g, "");
const digits = (s: string) => s.replace(/\D/g, "");

/** Last check before anything leaves the machine: throws if any private value appears in the payload. */
export function assertNoPrivateData(
  payload: string,
  privateValues: PrivateValue[],
) {
  const text = normalize(payload);
  const numbers = joinDigitGroups(payload);
  const leaked = privateValues.filter(({ value }) => {
    const n = digits(value);
    return (
      text.includes(normalize(value)) || (n.length >= 7 && numbers.includes(n))
    );
  });
  if (leaked.length === 0) return;
  // Name the kinds, never the values: error messages end up in logs and on screen.
  const kinds = [...new Set(leaked.map((v) => v.kind))].join(", ");
  throw new Error(
    `Blocked: the request still contained personal data (${kinds}). Nothing was sent.`,
  );
}
