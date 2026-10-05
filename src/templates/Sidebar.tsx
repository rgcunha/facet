import type { ReactNode } from "react";
import { filled, joinFilled, range } from "@/lib/cv/format";
import { Bullets, printable, type TemplateProps } from "./parts";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-[4mm]">
      <h2 className="mb-[1.5mm] break-after-avoid text-[11pt] font-normal tracking-[0.03em] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * A bold uppercase name over two columns: education, skills and languages in a narrow left column,
 * experience and projects on the right. Two columns can confuse some ATS parsers; the match report
 * says so.
 */
export function Sidebar({ contact, content }: TemplateProps) {
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
    <article className="font-quicksand text-[9.5pt] leading-[1.4] text-[#111111]">
      <header className="mb-[6mm]">
        <h1 className="font-montserrat text-[26pt] leading-none font-extrabold tracking-[-0.01em] uppercase">
          {contact.name || "Your name"}
        </h1>
        {content.headline && (
          <p className="mt-[1.5mm] text-[11pt] font-semibold">
            {content.headline}
          </p>
        )}
        {contactItems.length > 0 && (
          <p className="mt-[1mm] font-semibold">{contactItems.join("  |  ")}</p>
        )}
      </header>

      {content.summary.trim() && (
        <p className="mb-[5mm] whitespace-pre-line">{content.summary}</p>
      )}

      <div className="grid grid-cols-[30%_minmax(0,1fr)] gap-[7mm]">
        <aside>
          {education.length > 0 && (
            <Section title="Education">
              {education.map((e) => (
                <div key={e.id} className="mb-[2mm] break-inside-avoid">
                  <div className="font-bold">{e.degree}</div>
                  <div>
                    {joinFilled([e.institution, range(e.start, e.end)], " | ")}
                  </div>
                  {e.details && (
                    <p className="whitespace-pre-line">{e.details}</p>
                  )}
                </div>
              ))}
            </Section>
          )}
          {skills.length > 0 && (
            <Section title="Technical skills">
              {skills.map((s) => (
                <p key={s.id}>
                  {s.group && (
                    <strong className="font-bold">{s.group}: </strong>
                  )}
                  {filled(s.items).join(", ")}
                </p>
              ))}
            </Section>
          )}
          {languages.length > 0 && (
            <Section title="Languages">
              {languages.map((l) => (
                <p key={l.id}>
                  <strong className="font-bold">{l.name}</strong>
                  {l.level && ` – ${l.level}`}
                </p>
              ))}
            </Section>
          )}
        </aside>

        <div className="min-w-0">
          {experience.length > 0 && (
            <Section title="Experience">
              {experience.map((e) => (
                <div key={e.id} className="mb-[3mm] break-inside-avoid">
                  <div className="text-[10.5pt]">
                    {e.company.toUpperCase()}
                    {e.company.trim() && e.role.trim() && " | "}
                    {e.role && <span className="text-[9.5pt]">{e.role}</span>}
                  </div>
                  <div className="text-[#444444]">
                    {joinFilled([range(e.start, e.end), e.location])}
                  </div>
                  <Bullets
                    items={e.highlights}
                    className="mt-[0.8mm] pl-[5mm]"
                  />
                </div>
              ))}
            </Section>
          )}
          {projects.length > 0 && (
            <Section title="Projects">
              {projects.map((p) => (
                <div key={p.id} className="mb-[2mm] break-inside-avoid">
                  <div className="font-bold">
                    {joinFilled([p.name, p.link], " | ")}
                  </div>
                  {p.description && (
                    <p className="whitespace-pre-line">{p.description}</p>
                  )}
                </div>
              ))}
            </Section>
          )}
          {extras.map((x) => (
            <Section key={x.id} title={x.title || "Other"}>
              <Bullets items={x.items} className="mt-[0.8mm] pl-[5mm]" />
            </Section>
          ))}
        </div>
      </div>
    </article>
  );
}
