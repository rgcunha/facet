"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useWatch } from "react-hook-form";
import { analyzeAction, fetchJobAction, tailorAction } from "@/app/actions";
import { ModelPicker, useModel } from "@/components/model";
import { plural, toggled } from "@/lib/cv/format";
import type { Analysis, EditorValues, Run } from "@/lib/cv/schema";
import { MatchReport } from "./MatchReport";
import { SAVE_FAILED } from "./use-autosave";

const LANGUAGES = [
  ["en", "English"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["fr", "Français"],
  ["es", "Español"],
] as const;

/** What the user ticks under the report; nothing else is changed. The page count and language stay when unticked. */
type Choices = {
  suggestions: string[];
  confirmed: string[];
  reorder: boolean;
  fit: boolean;
  fitPages: 1 | 2;
  translate: boolean;
  translateTo: string;
};
/** The model may write "en-US" or "EN" for ISO 639-1 "en". */
const languageOf = (code: string) => code.trim().toLowerCase().slice(0, 2);

const defaultChoices = (report: Analysis, pages: 1 | 2): Choices => ({
  suggestions: report.suggestions,
  confirmed: [],
  reorder: true,
  fit: false,
  fitPages: pages,
  translate: false,
  translateTo: LANGUAGES.some(([code]) => code === languageOf(report.language))
    ? languageOf(report.language)
    : "en",
});

/**
 * Paste a job description (or fetch it), analyze how the CV matches it, tick what to change (the
 * report's suggestions, the skills you have, reordering, fitting, translating), then create a variant
 * of this CV with only those edits.
 */
export function TailorPanel({
  cvId,
  cvLanguage,
  onClose,
  saveFirst,
  track,
}: {
  cvId: string;
  /** ISO 639-1 code of the CV's language: translating is offered when the posting's differs. */
  cvLanguage: string;
  onClose: () => void;
  /** Saves pending edits, so the variant starts from what is on screen. */
  saveFirst: () => Promise<boolean>;
  /** Runs a model call that may finish while the panel is closed: the header shows it running, and the panel reopens on an error. */
  track: (
    run: () => Promise<string | undefined>,
  ) => Promise<string | undefined>;
}) {
  const [jobText, setJobText] = useState("");
  const [url, setUrl] = useState("");
  const cvPages = useWatch<EditorValues, "pages">({ name: "pages" });
  const [error, setError] = useState<string>();
  const [fetching, startFetch] = useTransition();
  const [tailoring, startTailor] = useTransition();
  const [analyzing, startAnalyze] = useTransition();
  /** The match report, the model call that wrote it, and what the user ticked under it. */
  const [analyzed, setAnalyzed] = useState<{
    report: Analysis;
    run: Run;
    choices: Choices;
  }>();
  const report = analyzed?.report;
  const busy = analyzing || tailoring;
  const model = useModel();

  // A report belongs to the job text it was made from.
  const changeJobText = (text: string) => {
    setJobText(text);
    setAnalyzed(undefined);
  };

  const fetchJob = () => {
    setError(undefined);
    const run = track(async () => {
      const result = await fetchJobAction(url);
      if ("error" in result) return result.error;
      changeJobText(result.text);
    });
    startFetch(async () => setError(await run));
  };

  const analyze = () => {
    setError(undefined);
    const run = track(async () => {
      if (!(await saveFirst())) return SAVE_FAILED;
      const result = await analyzeAction(cvId, jobText, model?.id ?? "");
      if ("error" in result) return result.error;
      setAnalyzed({
        ...result,
        choices: defaultChoices(result.report, cvPages),
      });
    });
    startAnalyze(async () => setError(await run));
  };

  const tailor = (analysis: Analysis, c: Choices) => {
    setError(undefined);
    const run = track(async () => {
      if (!(await saveFirst())) return SAVE_FAILED;
      const result = await tailorAction(cvId, {
        jobText,
        url,
        report: analysis,
        suggestions: c.suggestions,
        confirmed: c.confirmed,
        reorder: c.reorder,
        fit: c.fit ? c.fitPages : null,
        translate: c.translate ? c.translateTo : null,
        model: model?.id ?? "",
      });
      return result?.error; // On success the variant opens.
    });
    startTailor(async () => setError(await run));
  };

  return (
    <section
      aria-labelledby="tailor-h"
      className="card flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6 shadow-[0_8px_28px_rgba(21,24,30,.10)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="tailor-h" className="text-[22px] font-bold">
          Tailor to a job
        </h2>
        <button
          type="button"
          className="btn-link"
          onClick={onClose}
          // An analysis keeps running while closed; tailoring ends by opening the new variant.
          disabled={tailoring}
        >
          Close
        </button>
      </div>

      <label className="flex flex-col gap-1.5 font-semibold">
        Job description
        <textarea
          rows={report ? 5 : 12}
          className="textarea text-sm leading-relaxed font-normal"
          value={jobText}
          onChange={(e) => changeJobText(e.target.value)}
          // Locked while analyzing, so the report always belongs to the text on screen.
          disabled={busy}
          placeholder="Paste the whole job posting here."
        />
        <span className="text-[13px] font-normal text-muted">
          Paste it straight from the posting. This works for every site.
        </span>
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <label className="label flex-[1_1_260px]">
          Or fetch it from a link (works on some sites)
          <input
            type="url"
            className="input"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-secondary"
          onClick={fetchJob}
          disabled={!url || fetching || busy}
        >
          {fetching ? "Fetching…" : "Fetch"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {analyzed && (
        <>
          <MatchReport report={analyzed.report} run={analyzed.run} choosing />
          <WhatToChange
            report={analyzed.report}
            choices={analyzed.choices}
            onChange={(choices) => setAnalyzed({ ...analyzed, choices })}
            translatable={
              !!analyzed.report.language &&
              languageOf(analyzed.report.language) !== languageOf(cvLanguage)
            }
          />
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-md text-[13px] text-muted">
          Sends the job text and your CV without contact details, with your
          personal details masked. The score is computed on your computer. The
          variant opens on its changes, to keep or revert each one.
        </p>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <ModelPicker disabled={busy} />
          <button
            type="button"
            className={
              report ? "btn-secondary min-h-12" : "btn-primary min-h-12 px-5"
            }
            onClick={analyze}
            disabled={busy}
          >
            {analyzing
              ? "Analyzing…"
              : report
                ? "Analyze again"
                : "Analyze match →"}
          </button>
          {analyzed && (
            <button
              type="button"
              className="btn-primary min-h-12 px-5"
              onClick={() => tailor(analyzed.report, analyzed.choices)}
              disabled={busy}
            >
              {tailoring
                ? "Tailoring… (can take a minute)"
                : editCount(analyzed.choices)
                  ? `Create variant, applying ${plural(editCount(analyzed.choices), "edit")} →`
                  : "Create variant without changes →"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const editCount = (c: Choices) =>
  c.suggestions.length +
  c.confirmed.length +
  Number(c.reorder) +
  Number(c.fit) +
  Number(c.translate);

/** One ticked or unticked edit: a bordered row, like the Review panel's suggestions. */
function Choice({
  checked,
  onChange,
  title,
  detail,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  detail?: string;
  /** A control beside the title, e.g. how many pages to fit. */
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-start gap-3 rounded-lg border border-line px-3 py-2.5">
      <label className="flex flex-1 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-accent"
          checked={checked}
          onChange={onChange}
        />
        <span className="flex flex-col">
          <span className={detail ? "font-semibold" : ""}>{title}</span>
          {detail && <span className="text-[13px] text-muted">{detail}</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

/** The edits a variant may get, ticked one by one; the variant gets these and nothing else. */
function WhatToChange({
  report,
  choices,
  onChange,
  translatable,
}: {
  report: Analysis;
  choices: Choices;
  onChange: (choices: Choices) => void;
  /** Whether the posting's language differs from the CV's, so translating is offered. */
  translatable: boolean;
}) {
  const set = (patch: Partial<Choices>) => onChange({ ...choices, ...patch });
  return (
    <section aria-labelledby="wtc-h" className="flex flex-col gap-4">
      <div>
        <h3 id="wtc-h" className="text-lg font-bold">
          What to change
        </h3>
        <p className="text-sm text-muted">
          The variant gets only what you tick. Everything else stays exactly as
          in your CV.
        </p>
      </div>
      {report.suggestions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-bold">Suggestions</legend>
          {report.suggestions.map((text) => (
            <Choice
              key={text}
              title={text}
              checked={choices.suggestions.includes(text)}
              onChange={() =>
                set({ suggestions: toggled(choices.suggestions, text) })
              }
            />
          ))}
        </fieldset>
      )}
      {report.gaps.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-bold">
            Skills you may have{" "}
            <span className="text-[13px] font-normal text-muted">
              · tick only what’s true
            </span>
          </legend>
          {report.gaps.map((g) => (
            <Choice
              key={g.name}
              title={g.name}
              detail={g.why}
              checked={choices.confirmed.includes(g.name)}
              onChange={() =>
                set({ confirmed: toggled(choices.confirmed, g.name) })
              }
            />
          ))}
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-bold">Whole CV</legend>
        <Choice
          title="Put the most relevant first"
          detail="Reorders entries, bullets and skills. Nothing is reworded or removed."
          checked={choices.reorder}
          onChange={() => set({ reorder: !choices.reorder })}
        />
        <Choice
          title="Fit to the page length"
          detail="Shortens and drops the least relevant bullets. Unticked, nothing is dropped."
          checked={choices.fit}
          onChange={() => set({ fit: !choices.fit })}
        >
          <select
            aria-label="Pages to fit"
            className="input min-h-10 w-auto"
            value={choices.fitPages}
            onChange={(e) => set({ fitPages: Number(e.target.value) as 1 | 2 })}
          >
            <option value={1}>1 page</option>
            <option value={2}>2 pages</option>
          </select>
        </Choice>
        {translatable && (
          <Choice
            title="Translate"
            detail="Company names, schools and dates stay as they are."
            checked={choices.translate}
            onChange={() => set({ translate: !choices.translate })}
          >
            <select
              aria-label="Language to translate into"
              className="input min-h-10 w-auto"
              value={choices.translateTo}
              onChange={(e) => set({ translateTo: e.target.value })}
            >
              {LANGUAGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Choice>
        )}
      </fieldset>
    </section>
  );
}
