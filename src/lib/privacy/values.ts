import type { Contact, CvRecord, PrivateValue } from "@/lib/cv/schema";
import { sameValue } from "./redact";

const first = (values: PrivateValue[], kind: PrivateValue["kind"]) =>
  values.find((v) => v.kind === kind)?.value ?? "";

/** The contact block of a freshly imported CV: the first value of each kind the user kept masked. */
export const contactFromValues = (values: PrivateValue[]): Contact => ({
  name: first(values, "name"),
  email: first(values, "email"),
  phone: first(values, "phone"),
  location: first(values, "address"),
  dateOfBirth: first(values, "dob"),
  links: values.filter((v) => v.kind === "url").map((v) => v.value),
});

/**
 * Everything to mask when this CV goes to an LLM: its current contact details (so edits count too)
 * plus the values kept from its import.
 */
export function privateValuesOf({
  contact,
  vault,
}: Pick<CvRecord, "contact" | "vault">): PrivateValue[] {
  const fromContact = [
    { kind: "name", value: contact.name },
    { kind: "email", value: contact.email },
    { kind: "phone", value: contact.phone },
    { kind: "address", value: contact.location },
    { kind: "dob", value: contact.dateOfBirth },
    ...contact.links.map((value) => ({ kind: "url", value })),
  ].filter((v): v is PrivateValue => v.value.trim() !== "");
  return [...fromContact, ...vault].filter(
    (v, i, all) => all.findIndex((o) => sameValue(o.value, v.value)) === i,
  );
}
