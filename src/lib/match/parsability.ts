import { filled, visible } from "@/lib/cv/format";
import type { Contact, CvContent } from "@/lib/cv/schema";
import { parseDate } from "./dates";

/** What an applicant tracking system needs to read a CV into its fields, as pass/fail checks. */
export function readabilityChecks({
  contact,
  content,
}: {
  contact: Contact;
  content: CvContent;
}) {
  const roles = visible(content.experience);
  return [
    {
      label: "Name and an email or phone",
      pass:
        !!contact.name.trim() &&
        !!(contact.email.trim() || contact.phone.trim()),
    },
    {
      label: "Every role has a job title and a company",
      pass: roles.every((r) => r.role.trim() && r.company.trim()),
    },
    {
      label: "Every role has a start date an ATS can read",
      pass: roles.every((r) => parseDate(r.start) !== null),
    },
    {
      label: "Skills are listed",
      pass: content.skills.some((g) => filled(g.items).length > 0),
    },
  ];
}
