import type { ReactNode } from "react";
import { filled, joinFilled, range, visible } from "@/lib/cv/format";
import type { Contact, CvContent } from "@/lib/cv/schema";

function Section({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <section className="mt-[4.5mm]">
      <h2 className="mb-[1.5mm] break-after-avoid border-b border-[#1a1a1a] pb-[0.8mm] font-sans text-[8pt] font-bold tracking-[0.12em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Entry({
  title,
  when,
  children,
}: {
  title: string;
  when: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-[2.5mm] break-inside-avoid">
      <div className="flex justify-between gap-4">
        <strong className="font-semibold">{title}</strong>
        {when && <span className="shrink-0 text-[#4a4a4a]">{when}</span>}
      </div>
      {children}
    </div>
  );
}

/** The one CV template. Pure markup, so the editor preview and the print route render exactly the same thing. */
export function Classic({
  contact,
  content,
}: {
  contact: Contact;
  content: CvContent;
}) {
  const contactLine = filled([
    contact.location,
    contact.phone,
    contact.email,
    ...contact.links,
    contact.dateOfBirth,
  ]);
  // Entries added in the editor but left empty must not print headings or take space.
  const experience = visible(content.experience);
  const education = visible(content.education);
  const projects = visible(content.projects);
  const languages = visible(content.languages);
  const skills = content.skills.filter((s) => filled(s.items).length);

  return (
    <article className="font-serif text-[10pt] leading-[1.45] text-[#1a1a1a]">
      <header>
        <h1 className="text-[22pt] leading-tight font-bold">
          {contact.name || "Your name"}
        </h1>
        {content.headline && (
          <p className="text-[12pt] text-[#3a3a3a]">{content.headline}</p>
        )}
        {contactLine.length > 0 && (
          <p className="mt-[1.5mm] font-sans text-[8.5pt] text-[#4a4a4a]">
            {contactLine.join(" · ")}
          </p>
        )}
      </header>

      <Section title="Summary" show={!!content.summary.trim()}>
        <p className="whitespace-pre-line">{content.summary}</p>
      </Section>

      <Section title="Experience" show={experience.length > 0}>
        {experience.map((e) => (
          <Entry
            key={e.id}
            title={joinFilled([e.role, e.company])}
            when={range(e.start, e.end)}
          >
            {e.location && <div className="text-[#4a4a4a]">{e.location}</div>}
            <ul className="mt-[0.8mm] list-disc pl-[4.5mm]">
              {filled(e.highlights).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </Entry>
        ))}
      </Section>

      <Section title="Education" show={education.length > 0}>
        {education.map((e) => (
          <Entry
            key={e.id}
            title={joinFilled([e.degree, e.institution])}
            when={range(e.start, e.end)}
          >
            {e.details && <p className="whitespace-pre-line">{e.details}</p>}
          </Entry>
        ))}
      </Section>

      <Section title="Skills" show={skills.length > 0}>
        {skills.map((s) => (
          <p key={s.id}>
            {s.group && <strong className="font-semibold">{s.group}: </strong>}
            {filled(s.items).join(", ")}
          </p>
        ))}
      </Section>

      <Section title="Projects" show={projects.length > 0}>
        {projects.map((p) => (
          <Entry key={p.id} title={p.name} when={p.link}>
            {p.description && (
              <p className="whitespace-pre-line">{p.description}</p>
            )}
          </Entry>
        ))}
      </Section>

      <Section title="Languages" show={languages.length > 0}>
        <p>
          {joinFilled(
            languages.map((l) =>
              joinFilled([l.name, l.level && `(${l.level})`], " "),
            ),
          )}
        </p>
      </Section>

      {content.extras.map((x) => (
        <Section
          key={x.id}
          title={x.title || "Other"}
          show={filled(x.items).length > 0}
        >
          <ul className="list-disc pl-[4.5mm]">
            {filled(x.items).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Section>
      ))}
    </article>
  );
}
