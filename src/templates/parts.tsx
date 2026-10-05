import { filled, joinFilled, visible } from "@/lib/cv/format";
import type { Contact, CvContent, CvView } from "@/lib/cv/schema";

/** What every template prints: only filled-in values, so entries added but left empty take no space. */
export function printable(contact: Contact, content: CvContent) {
  return {
    contactItems: filled([
      contact.location,
      contact.phone,
      contact.email,
      ...contact.links,
      contact.dateOfBirth,
    ]),
    experience: visible(content.experience),
    education: visible(content.education),
    projects: visible(content.projects),
    languages: visible(content.languages),
    skills: content.skills.filter((s) => filled(s.items).length),
    extras: content.extras.filter((x) => filled(x.items).length),
  };
}

export type TemplateProps = Omit<CvView, "template">;

/** "Portuguese (Native) · English (C2)" */
export const languagesLine = (languages: CvContent["languages"]) =>
  joinFilled(
    languages.map((l) => joinFilled([l.name, l.level && `(${l.level})`], " ")),
  );

/** A bulleted list of the filled-in items; each template sets the indent. */
export function Bullets({
  items,
  className,
}: {
  items: string[];
  className: string;
}) {
  return (
    <ul className={`list-disc ${className}`}>
      {filled(items).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
