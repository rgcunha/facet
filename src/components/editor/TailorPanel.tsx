"use client";

import { useState, useTransition } from "react";
import { analyzeAction, fetchJobAction, tailorAction } from "@/app/actions";
import { ModelPicker, useModel } from "@/components/model";
import { plural } from "@/lib/cv/format";
import type { Analysis, Run } from "@/lib/cv/schema";
import { MatchReport } from "./MatchReport";
import { SAVE_FAILED } from "./use-autosave";

const LANGUAGES = [
  ["", "Same as the job"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["fr", "Français"],
  ["es", "Español"],
] as const;

/**
 * Paste a job description (or fetch it), analyze how the CV matches it, confirm the gaps that are
 * true, then create a tailored variant of this CV.
 */
export function TailorPanel({
  cvId,
  onClose,
  saveFirst,
  track,
}: {
  cvId: string;
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
  const [language, setLanguage] = useState("");
  const [pages, setPages] = useState<1 | 2>(1);
  const [error, setError] = useState<string>();
  const [fetching, startFetch] = useTransition();
  const [tailoring, startTailor] = useTransition();
  const [analyzing, startAnalyze] = useTransition();
  /** The match report and the model call that wrote it. */
  const [analyzed, setAnalyzed] = useState<{ report: Analysis; run: Run }>();
  const report = analyzed?.report;
  const [confirmed, setConfirmed] = useState<string[]>([]);
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
      setAnalyzed(result);
      setConfirmed([]);
    });
    startAnalyze(async () => setError(await run));
  };

  const toggle = (name: string) =>
    setConfirmed(
      confirmed.includes(name)
        ? confirmed.filter((n) => n !== name)
        : [...confirmed, name],
    );

  const tailor = (analysis: Analysis) => {
    setError(undefined);
    const run = track(async () => {
      if (!(await saveFirst())) return SAVE_FAILED;
      const result = await tailorAction(cvId, {
        jobText,
        url,
        language,
        pages,
        report: analysis,
        confirmed,
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

      <div className="flex flex-wrap gap-6">
        <label className="label">
          Output language
          <select
            className="input w-auto"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Length
          <select
            className="input w-auto"
            value={pages}
            onChange={(e) => setPages(Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>1 page</option>
            <option value={2}>2 pages</option>
          </select>
        </label>
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
        <MatchReport
          report={analyzed.report}
          run={analyzed.run}
          confirmed={confirmed}
          onToggle={toggle}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-md text-[13px] text-muted">
          Sends the job text and your CV without contact details, with your
          personal details masked. The score is computed on your computer.
          Nothing should be invented; anything new is flagged for you.
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
          {report && (
            <button
              type="button"
              className="btn-primary min-h-12 px-5"
              onClick={() => tailor(report)}
              disabled={busy}
            >
              {tailoring
                ? "Tailoring… (can take a minute)"
                : confirmed.length
                  ? `Create tailored variant, adding ${plural(confirmed.length, "confirmed skill")} →`
                  : "Create tailored variant →"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
