"use client";

import { useDeferredValue, useId, useMemo } from "react";
import { useWatch } from "react-hook-form";
import type { Analysis, CvView, EditorValues } from "@/lib/cv/schema";
import { type MatchScore, scoreCv } from "@/lib/match/score";

/** The score of what is in the form now, recomputed as the user edits. */
function useLiveScore(report: Analysis) {
  const values = useDeferredValue(useWatch<EditorValues>() as EditorValues);
  return useMemo(() => scoreCv(values, report), [values, report]);
}

/** A variant's base CV scored against the variant's job: the "before" of before → after. */
export function useBaseScore(
  base: CvView | undefined,
  report: Analysis | undefined,
) {
  return useMemo(
    () => (base && report ? scoreCv(base, report) : undefined),
    [base, report],
  );
}

const TITLE_LABEL = { match: "Match", partial: "Partial", none: "No match" };

/** "62% → 84%" when there is a before, else "62%". */
function ScoreChange({
  before,
  score,
}: {
  before?: MatchScore;
  score: MatchScore;
}) {
  return (
    <span className="tabular-nums">
      {before && before.total !== score.total && (
        <span className="text-muted">{before.total}% → </span>
      )}
      <strong>{score.total}%</strong>
    </span>
  );
}

/** The live score as text, e.g. in the variant's header. */
export function LiveScoreChange({
  report,
  before,
}: {
  report: Analysis;
  before?: MatchScore;
}) {
  return <ScoreChange before={before} score={useLiveScore(report)} />;
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-dashed border-muted px-2.5 py-0.5 text-[13px] text-subtle"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="font-bold">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The match report: the live score and its parts, strengths, gaps, missing skills and suggestions.
 * With `onToggle` (Tailor panel) the gaps are checkboxes; without it (a variant) the confirmed ones
 * are listed.
 */
export function MatchReport({
  report,
  confirmed,
  onToggle,
  before,
}: {
  report: Analysis;
  confirmed: string[];
  onToggle?: (name: string) => void;
  /** The base CV's score, on a variant. */
  before?: MatchScore;
}) {
  const score = useLiveScore(report);
  const headingId = useId();
  const failed = score.readability.filter((c) => !c.pass);
  const rows: [string, string][] = [
    ["Must-have requirements", `${score.must.hit} of ${score.must.of}`],
    ["Nice-to-have", `${score.nice.hit} of ${score.nice.of}`],
    ["Job title", `${TITLE_LABEL[score.title]} (${report.title})`],
    [
      "Years of experience",
      score.years.asked === null
        ? `${score.years.have}`
        : `${score.years.have} (asks ${score.years.asked}+)`,
    ],
    [
      "ATS readability",
      `${score.readability.length - failed.length} of ${score.readability.length} checks pass`,
    ],
  ];

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-line bg-white"
    >
      <div className="flex flex-wrap gap-x-8 gap-y-5 border-b border-line bg-canvas p-5">
        <div className="flex flex-col gap-1">
          <h3
            id={headingId}
            className="text-[13px] font-semibold tracking-wide text-muted uppercase"
          >
            Match report
          </h3>
          <div className="text-5xl leading-none">
            <ScoreChange before={before} score={score} />
          </div>
          <div className="h-2 w-44 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent"
              style={{ width: `${score.total}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {before ? "Base CV → this variant. " : ""}Updates as you edit.
          </p>
        </div>
        <dl className="grid min-w-0 flex-[1_1_320px] grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm tabular-nums">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-subtle">{label}</dt>
              <dd className="font-semibold break-words">{value}</dd>
            </div>
          ))}
        </dl>
        {failed.length > 0 && (
          <p className="basis-full text-sm text-warn">
            To fix for ATS: {failed.map((c) => c.label).join("; ")}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5 p-5">
        <List title="Strengths" items={report.strengths} />

        {onToggle && report.gaps.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="font-bold">
              You may have these, but your CV doesn’t show them
            </legend>
            <p className="text-[13px] text-muted">
              Tick only what’s true. Tailoring adds the ticked ones and nothing
              else.
            </p>
            {report.gaps.map((g) => (
              <label
                key={g.name}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 accent-accent"
                  checked={confirmed.includes(g.name)}
                  onChange={() => onToggle(g.name)}
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{g.name}</span>
                  <span className="text-[13px] text-muted">{g.why}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!onToggle && confirmed.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h4 className="font-bold">You confirmed</h4>
            <Chips items={confirmed} />
          </div>
        )}

        {report.missing.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h4 className="font-bold">Missing from your experience</h4>
            <Chips items={report.missing} />
            <p className="text-[13px] text-muted">
              Never added. Mention them in a cover letter or interview if you’re
              learning them.
            </p>
          </div>
        )}

        <List title="Suggestions" items={report.suggestions} />
      </div>
    </section>
  );
}
