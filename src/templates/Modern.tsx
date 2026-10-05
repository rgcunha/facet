import type { ReactNode } from "react";
import { filled, joinFilled, range } from "@/lib/cv/format";
import { Bullets, languagesLine, printable, type TemplateProps } from "./parts";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-[4.5mm]">
      <h2 className="mb-[1.5mm] flex break-after-avoid items-center gap-[1.5mm] text-[8.5pt] font-bold tracking-[0.1em] text-[#0f4c5c] uppercase">
        <span aria-hidden className="h-[0.8mm] w-[3.5mm] bg-[#0f4c5c]" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A heading line, then a muted line with place on the left and dates on the right. */
function Entry({
  title,
  place,
  when,
  children,
}: {
  title: string;
  place: string;
  when: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-[2.5mm] break-inside-avoid">
      <div className="text-[10pt] font-bold text-[#0f4c5c]">{title}</div>
      <div className="flex justify-between gap-4 text-[#4b535b]">
        <span>{place}</span>
        {when && <span className="shrink-0 tabular-nums">{when}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Sans-serif, one column, ATS-friendly: centered header, skills right after the summary (keywords
 * near the top), and the job title first in each role.
 */
export function Modern({ contact, content }: TemplateProps) {
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
    <article className="font-plex text-[9.5pt] leading-[1.5] text-[#1b1f24]">
      <header className="text-center">
        <h1 className="text-[22pt] leading-tight font-bold text-[#0f4c5c]">
          {contact.name || "Your name"}
        </h1>
        {content.headline && (
          <p className="text-[11.5pt] text-[#33393f]">{content.headline}</p>
        )}
        {contactItems.length > 0 && (
          <p className="mt-[1mm] text-[8.5pt] text-[#4b535b]">
            {contactItems.join(" · ")}
          </p>
        )}
      </header>

      {content.summary.trim() && (
        <Section title="Summary">
          <p className="whitespace-pre-line">{content.summary}</p>
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Core skills">
          <p>
            {skills.map((s, i) => (
              <span key={s.id}>
                {i > 0 && " · "}
                {s.group && <strong>{s.group}: </strong>}
                {filled(s.items).join(", ")}
              </span>
            ))}
          </p>
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="Experience">
          {experience.map((e) => (
            <Entry
              key={e.id}
              title={e.role || e.company}
              place={joinFilled([e.role ? e.company : "", e.location])}
              when={range(e.start, e.end)}
            >
              <Bullets items={e.highlights} className="mt-[0.8mm] pl-[4.5mm]" />
            </Entry>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((e) => (
            <Entry
              key={e.id}
              title={e.degree || e.institution}
              place={e.degree ? e.institution : ""}
              when={range(e.start, e.end)}
            >
              {e.details && <p className="whitespace-pre-line">{e.details}</p>}
            </Entry>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Projects">
          {projects.map((p) => (
            <Entry key={p.id} title={p.name} place={p.link} when="">
              {p.description && (
                <p className="whitespace-pre-line">{p.description}</p>
              )}
            </Entry>
          ))}
        </Section>
      )}

      {languages.length > 0 && (
        <Section title="Languages">
          <p>{languagesLine(languages)}</p>
        </Section>
      )}

      {extras.map((x) => (
        <Section key={x.id} title={x.title || "Other"}>
          <Bullets items={x.items} className="mt-[0.8mm] pl-[4.5mm]" />
        </Section>
      ))}
    </article>
  );
}
