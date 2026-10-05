import type { ReactNode } from "react";
import { filled, joinFilled, range } from "@/lib/cv/format";
import { Bullets, languagesLine, printable, type TemplateProps } from "./parts";

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

/**
 * Serif, one column. Like every template, pure markup, so the editor preview and the print route
 * render exactly the same thing.
 */
export function Classic({ contact, content }: TemplateProps) {
  const {
    contactItems,
    experience,
    education,
    projects,
    languages,
    skills,
    extras,
  } = printable(contact, content);

  return (
    <article className="font-serif text-[10pt] leading-[1.45] text-[#1a1a1a]">
      <header>
        <h1 className="text-[22pt] leading-tight font-bold">
          {contact.name || "Your name"}
        </h1>
        {content.headline && (
          <p className="text-[12pt] text-[#3a3a3a]">{content.headline}</p>
        )}
        {contactItems.length > 0 && (
          <p className="mt-[1.5mm] font-sans text-[8.5pt] text-[#4a4a4a]">
            {contactItems.join(" · ")}
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
            <Bullets items={e.highlights} className="mt-[0.8mm] pl-[4.5mm]" />
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
        <p>{languagesLine(languages)}</p>
      </Section>

      {extras.map((x) => (
        <Section key={x.id} title={x.title || "Other"} show>
          <Bullets items={x.items} className="pl-[4.5mm]" />
        </Section>
      ))}
    </article>
  );
}
