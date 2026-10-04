"use client";

import { useState, useTransition } from "react";
import { fetchJobAction, tailorAction } from "@/app/actions";

const LANGUAGES = [
  ["", "Same as the job"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["pt", "Português"],
  ["fr", "Français"],
  ["es", "Español"],
] as const;

/** Paste a job description (or fetch it), then create a tailored variant of this CV. */
export function TailorPanel({
  cvId,
  onClose,
  saveFirst,
}: {
  cvId: string;
  onClose: () => void;
  /** Saves pending edits, so the variant starts from what is on screen. */
  saveFirst: () => Promise<boolean>;
}) {
  const [jobText, setJobText] = useState("");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("");
  const [pages, setPages] = useState<1 | 2>(1);
  const [error, setError] = useState<string>();
  const [fetching, startFetch] = useTransition();
  const [tailoring, startTailor] = useTransition();

  const fetchJob = () =>
    startFetch(async () => {
      setError(undefined);
      const result = await fetchJobAction(url);
      if ("error" in result) setError(result.error);
      else setJobText(result.text);
    });

  const tailor = () =>
    startTailor(async () => {
      setError(undefined);
      if (!(await saveFirst()))
        return setError("Couldn’t save your latest edits; try again.");
      const result = await tailorAction(cvId, {
        jobText,
        url,
        language,
        pages,
      });
      if (result) setError(result.error);
    });

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
          disabled={tailoring}
        >
          Close
        </button>
      </div>

      <label className="flex flex-col gap-1.5 font-semibold">
        Job description
        <textarea
          rows={12}
          className="textarea text-sm leading-relaxed font-normal"
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
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
          disabled={!url || fetching}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-md text-[13px] text-muted">
          Sends the job text and your CV without contact details, with your
          personal details masked. Nothing should be invented; anything new is
          flagged for you.
        </p>
        <button
          type="button"
          className="btn-primary min-h-12 px-5"
          onClick={tailor}
          disabled={tailoring}
        >
          {tailoring
            ? "Tailoring… (can take a minute)"
            : "Create tailored variant →"}
        </button>
      </div>
    </section>
  );
}
