"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useWatch } from "react-hook-form";
import { type ReviseRequest, reviewAction } from "@/app/actions";
import { joinFilled, plural, SECTION_TITLES } from "@/lib/cv/format";
import type {
  CvContent,
  EditorValues,
  PrivateValue,
  Suggestion,
} from "@/lib/cv/schema";
import { detectInText } from "@/lib/privacy/detect";
import { SAVE_FAILED } from "./use-autosave";

/**
 * Reviews the CV as soon as it first opens, lists the suggestions as checkboxes (ticked), and applies the
 * ticked ones. "Ask for something else" sends the user's own instruction, masking any name in it
 * that looks personal.
 */
export function ReviewPanel({
  cvId,
  variant,
  onClose,
  saveFirst,
  track,
  revise,
  revising,
}: {
  cvId: string;
  /** A tailored variant: fixes keep the job's keywords and change only this variant. */
  variant: boolean;
  onClose: () => void;
  /** Saves pending edits, so the review reads what is on screen. */
  saveFirst: () => Promise<boolean>;
  /** Runs a model call that may finish while the panel is closed: the header shows it running, and the panel reopens on an error. */
  track: (
    run: () => Promise<string | undefined>,
  ) => Promise<string | undefined>;
  /** Applies an edit; the editor locks, then reloads with the changes highlighted. */
  revise: (request: ReviseRequest, masks?: PrivateValue[]) => void;
  revising: boolean;
}) {
  /** `snapshot` is the CV as it was reviewed: suggestions quote its words, so they don't apply once it's edited. */
  const [result, setResult] = useState<{
    suggestions: Suggestion[];
    model: string;
    snapshot: string;
  }>();
  const suggestions = result?.suggestions;
  const [unticked, setUnticked] = useState<number[]>([]);
  const [error, setError] = useState<string>();
  const [reviewing, startReview] = useTransition();
  const [asking, setAsking] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [sendAsWritten, setSendAsWritten] = useState<string[]>([]);
  const content = useWatch<EditorValues, "content">({ name: "content" });

  const review = () => {
    setError(undefined);
    const run = track(async () => {
      if (!(await saveFirst())) return SAVE_FAILED;
      const snapshot = JSON.stringify(content);
      const answer = await reviewAction(cvId);
      if ("error" in answer) return answer.error;
      setResult({ ...answer, snapshot });
      setUnticked([]);
    });
    startReview(async () => setError(await run));
  };

  // The review starts when the panel first opens. The ref stops it running again when the panel is shown
  // again (effects re-run when an Activity becomes visible) and on React's dev double-mount.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    review();
  });

  // Only while there is an instruction: otherwise every keystroke in the form would rescan the CV.
  const found = useMemo(
    () =>
      asking && instruction.trim() ? detectInText(instruction, content) : [],
    [asking, instruction, content],
  );
  const masks = found.filter((v) => !sendAsWritten.includes(v.value));

  const busy = reviewing || revising;
  const stale = !!result && JSON.stringify(content) !== result.snapshot;
  const all = (suggestions ?? []).map((s, i) => ({
    ...s,
    i,
    section: sectionLabel(content, s),
  }));
  const ticked = all.filter((s) => s.kind === "fix" && !unticked.includes(s.i));
  const sections = [...new Set(all.map((s) => s.section))];
  const toggle = (i: number) =>
    setUnticked(
      unticked.includes(i) ? unticked.filter((n) => n !== i) : [...unticked, i],
    );

  return (
    <section
      aria-labelledby="review-h"
      className="card flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-6 shadow-[0_8px_28px_rgba(21,24,30,.10)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="review-h" className="text-[22px] font-bold">
          Review this CV
        </h2>
        <button
          type="button"
          className="btn-link"
          onClick={onClose}
          // A review keeps running while closed; applying locks the page until it reloads.
          disabled={revising}
        >
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="flex-[1_1_360px] text-sm text-muted">
          Checked against good CV practice for your field.
          {variant && " Fixes keep the keywords the job asks for."} Untick
          anything you disagree with.
        </p>
        <button
          type="button"
          className="btn-secondary ml-auto"
          onClick={review}
          disabled={busy}
        >
          {reviewing ? "Reviewing…" : "Review again"}
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

      {reviewing && !suggestions && (
        <p role="status" className="text-sm text-muted">
          Reviewing your CV… This can take a minute.
        </p>
      )}

      {suggestions?.length === 0 && (
        <p role="status" className="text-sm">
          No suggestions from {result?.model}: your CV already follows good
          practice.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <fieldset className="flex flex-col gap-4" disabled={busy}>
          <legend className="mb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">
            {plural(suggestions.length, "suggestion")}
            <span className="font-normal tracking-normal normal-case">
              {" "}
              · reviewed by {result?.model}
            </span>
          </legend>
          {sections.map((section) => (
            <div key={section} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-subtle">{section}</h3>
              {all
                .filter((s) => s.section === section)
                .map((s) => (
                  <SuggestionRow
                    key={s.i}
                    suggestion={s}
                    checked={!unticked.includes(s.i)}
                    onToggle={() => toggle(s.i)}
                  />
                ))}
            </div>
          ))}
        </fieldset>
      )}

      {stale && (
        <p role="status" className="text-sm text-warn">
          You edited the CV after this review. Review again before applying the
          fixes.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-md text-[13px] text-muted">
          {variant
            ? "Fixes change only this variant. To improve every future application, review your base CV."
            : "Fixes show up in the form with Was, Revert and Keep. They only change this CV: variants you already made stay as they are."}
        </p>
        <button
          type="button"
          className="btn-primary min-h-12 px-5"
          onClick={() => revise({ suggestions: ticked })}
          disabled={busy || stale || ticked.length === 0}
        >
          {revising
            ? "Applying… (can take a minute)"
            : ticked.length
              ? `Apply ${plural(ticked.length, "fix", "fixes")} →`
              : "Nothing to apply"}
        </button>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-3">
        <button
          type="button"
          className="btn-link self-start"
          aria-expanded={asking}
          onClick={() => setAsking(!asking)}
        >
          {asking ? "▾" : "▸"} Ask for something else
        </button>
        {asking && (
          <div className="flex flex-col gap-2.5">
            <label className="label">
              What should change?
              <textarea
                rows={3}
                className="textarea"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={busy}
                placeholder="e.g. Make the latest role read more senior: put design reviews first."
              />
            </label>
            {found.map((v) => {
              const masked = !sendAsWritten.includes(v.value);
              return (
                <div
                  key={v.value}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-[1_1_260px]">
                    <strong>{v.value}</strong>{" "}
                    <span className="text-muted">
                      looks personal.{" "}
                      {masked
                        ? "It will be masked."
                        : "It will be sent as written."}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary min-h-10"
                    onClick={() =>
                      setSendAsWritten(
                        masked
                          ? [...sendAsWritten, v.value]
                          : sendAsWritten.filter((x) => x !== v.value),
                      )
                    }
                  >
                    {masked ? "Send as written" : "Mask it"}
                  </button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex-[1_1_280px] text-[13px] text-muted">
                Sent with your CV, never your contact details.
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => revise({ instruction }, masks)}
                disabled={busy || instruction.trim().length < 3}
              >
                {revising ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const AREA_LABELS: Record<Suggestion["area"], string> = {
  headline: "Headline",
  summary: "Summary",
  ...SECTION_TITLES,
  whole: "Whole CV",
};

/** What an entry is called in a heading: its employer, school, project, group or section title. */
const entryName = (entry: Record<string, unknown>) =>
  joinFilled(
    ["company", "institution", "name", "group", "title"].map((key) =>
      String(entry[key] ?? ""),
    ),
  );

/** Labelled here, from the entry id the model returned, so headings always match the form. */
function sectionLabel(content: CvContent, { area, entryId }: Suggestion) {
  if (area === "headline" || area === "summary" || area === "whole")
    return AREA_LABELS[area];
  const entry = (content[area] as { id: string }[]).find(
    (e) => e.id === entryId,
  );
  const name = entry && entryName(entry);
  if (!name) return AREA_LABELS[area];
  return area === "skills" ? `Skills · ${name}` : name; // a group name alone ("Backend") reads like a role
}

/** A fix is a checkbox (as when confirming gaps); what only the user can add is a plain note with a pencil. */
function SuggestionRow({
  suggestion,
  checked,
  onToggle,
}: {
  suggestion: Suggestion;
  checked: boolean;
  onToggle: () => void;
}) {
  const text = (
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{suggestion.problem}</span>
      <span className="text-[13px] text-muted">{suggestion.detail}</span>
    </span>
  );
  if (suggestion.kind === "fix")
    return (
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5">
        <input
          type="checkbox"
          className="mt-0.5 size-5 accent-accent"
          checked={checked}
          onChange={onToggle}
        />
        {text}
      </label>
    );
  return (
    <div className="flex min-h-11 items-start gap-3 rounded-lg border border-dashed border-muted px-3 py-2.5">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Edit this yourself"
        className="mt-0.5 flex-none text-muted"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
      {text}
    </div>
  );
}
