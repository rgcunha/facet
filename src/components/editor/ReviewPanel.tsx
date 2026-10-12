"use client";

import { useMemo, useState, useTransition } from "react";
import { useWatch } from "react-hook-form";
import { type ReviseRequest, reviewAction } from "@/app/actions";
import { ModelPicker, RunInfo, useModel } from "@/components/model";
import { entryName, plural, SECTION_TITLES, toggled } from "@/lib/cv/format";
import type {
  ChecklistRule,
  CvContent,
  EditorValues,
  PrivateValue,
  Run,
  Suggestion,
  Todo,
} from "@/lib/cv/schema";
import { detectInText } from "@/lib/privacy/detect";
import { Checklist } from "./Checklist";
import { goTo } from "./todos";
import { SAVE_FAILED } from "./use-autosave";

/**
 * Opens on the checklist and the Model picker; a review runs only when asked. Results come in two
 * sections: fixes to tick and apply, and what needs the user's input (also kept on the CV as to-dos).
 * "Ask for something else" sends the user's own instruction, masking any name in it that looks
 * personal.
 */
export function ReviewPanel({
  cvId,
  variant,
  rules,
  todos,
  onTodos,
  onClose,
  saveFirst,
  track,
  revise,
  revising,
}: {
  cvId: string;
  /** A tailored variant: fixes keep the job's keywords and change only this variant. */
  variant: boolean;
  /** The review checklist, saved for every CV. */
  rules: ChecklistRule[];
  /** The CV's to-dos, as the form shows them (Done there removes them here too). */
  todos: Todo[];
  /** A review replaced the CV's to-dos. */
  onTodos: (todos: Todo[]) => void;
  onClose: () => void;
  /** Saves pending edits, so the review reads what is on screen. */
  saveFirst: () => Promise<boolean>;
  /** Runs a model call that may finish while the panel is closed: the header shows it running, and the panel reopens on an error. */
  track: (
    run: () => Promise<string | undefined>,
  ) => Promise<string | undefined>;
  /** Applies an edit (the editor locks meanwhile) and loads it into the form; resolves to whether it worked. */
  revise: (request: ReviseRequest, masks?: PrivateValue[]) => Promise<boolean>;
  revising: boolean;
}) {
  /**
   * `snapshot` is the CV as it was reviewed: suggestions quote its words, so they don't apply once it's
   * edited. `unticked`: the fixes the user turned down, by index. `applied`: how many fixes Apply
   * made; the list no longer matches the CV after that.
   */
  const [result, setResult] = useState<{
    suggestions: Suggestion[];
    run: Run;
    snapshot: string;
    unticked: number[];
    applied?: number;
  }>();
  /** Back on the start screen after a review, to change the checklist or the model. */
  const [atStart, setAtStart] = useState(false);
  /** Checklist edits not saved yet: a review would ignore them, so it waits. */
  const [editingRules, setEditingRules] = useState(false);
  const [error, setError] = useState<string>();
  const [reviewing, startReview] = useTransition();
  const [asking, setAsking] = useState(false);
  const [instruction, setInstruction] = useState("");
  /** The last instruction was applied: the box is clear for the next one. */
  const [asked, setAsked] = useState(false);
  const [sendAsWritten, setSendAsWritten] = useState<string[]>([]);
  const content = useWatch<EditorValues, "content">({ name: "content" });
  const model = useModel();

  const review = () => {
    setError(undefined);
    const run = track(async () => {
      if (!(await saveFirst())) return SAVE_FAILED;
      const snapshot = JSON.stringify(content);
      const answer = await reviewAction(cvId, model?.id ?? "");
      if ("error" in answer) return answer.error;
      setResult({ ...answer, snapshot, unticked: [] });
      onTodos(answer.todos);
      setAtStart(false);
    });
    startReview(async () => setError(await run));
  };

  // Only while there is an instruction: otherwise every keystroke in the form would rescan the CV.
  const found = useMemo(
    () =>
      asking && instruction.trim() ? detectInText(instruction, content) : [],
    [asking, instruction, content],
  );
  const masks = found.filter((v) => !sendAsWritten.includes(v.value));

  const busy = reviewing || revising;
  const showStart = !result || atStart;
  const stale = !!result && JSON.stringify(content) !== result.snapshot;
  const all = (result?.suggestions ?? []).map((s, i) => ({
    ...s,
    i,
    section: sectionLabel(content, s),
  }));
  const fixes = all.filter((s) => s.kind === "fix");
  const unticked = result?.unticked ?? [];
  const ticked = fixes.filter((s) => !unticked.includes(s.i));
  const fixSections = [...new Set(fixes.map((s) => s.section))];
  const toggle = (i: number) =>
    setResult(
      result && {
        ...result,
        unticked: toggled(unticked, i),
      },
    );
  const reviewButton = (label: string, primary: boolean) => (
    <button
      type="button"
      className={primary ? "btn-primary min-h-12 px-5" : "btn-secondary"}
      onClick={review}
      disabled={busy || editingRules}
    >
      {reviewing ? "Reviewing…" : label}
    </button>
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
          // A review keeps running while closed; the editor is locked while the model edits.
          disabled={revising}
        >
          Close
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

      {showStart ? (
        <>
          <p className="text-sm text-muted">
            The model checks your CV against the list below, read for your
            field. You choose which fixes to apply.
            {variant &&
              " On a variant, fixes keep the keywords the job asks for."}
          </p>
          <Checklist
            rules={rules}
            disabled={busy}
            onEditing={setEditingRules}
          />
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
            <p className="max-w-sm text-[13px] text-muted">
              Sends your CV without contact details, with your personal details
              masked.
              {result && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="btn-link min-h-0 p-0 text-[13px]"
                    onClick={() => setAtStart(false)}
                  >
                    Back to the results
                  </button>
                </>
              )}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <ModelPicker disabled={busy} />
              {reviewButton("Review →", true)}
            </div>
          </div>
          {editingRules && (
            <p role="status" className="text-sm text-muted">
              Save or cancel your checklist changes first.
            </p>
          )}
          {reviewing && (
            <p role="status" className="text-sm text-muted">
              Reviewing your CV… This can take a minute.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="flex-[1_1_300px] text-sm text-muted">
              {plural(result.suggestions.length, "suggestion")} ·{" "}
              <RunInfo run={result.run} />. Checked against{" "}
              <button
                type="button"
                className="btn-link min-h-0 p-0 text-sm"
                onClick={() => setAtStart(true)}
              >
                your checklist
              </button>
              .
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <ModelPicker disabled={busy} />
              {reviewButton("Review again", false)}
            </div>
          </div>

          {result.suggestions.length === 0 && (
            <p role="status" className="text-sm">
              No suggestions: your CV already follows your checklist.
            </p>
          )}

          {fixes.length > 0 && (
            <section aria-labelledby="fixes-h" className="flex flex-col gap-3">
              <SectionHeading id="fixes-h" count={fixes.length}>
                Can be fixed for you
              </SectionHeading>
              {result.applied ? (
                <p role="status" className="text-sm">
                  {plural(result.applied, "fix", "fixes")} applied, highlighted
                  in the form. Review again to check the result.
                </p>
              ) : (
                <>
                  <fieldset className="flex flex-col gap-4" disabled={busy}>
                    <legend className="sr-only">Fixes to apply</legend>
                    {fixSections.map((section) => (
                      <div key={section} className="flex flex-col gap-2">
                        <h4 className="text-sm font-semibold text-subtle">
                          {section}
                        </h4>
                        {fixes
                          .filter((s) => s.section === section)
                          .map((s) => (
                            <label
                              key={s.i}
                              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 size-5 accent-accent"
                                checked={!unticked.includes(s.i)}
                                onChange={() => toggle(s.i)}
                              />
                              <SuggestionText suggestion={s} />
                            </label>
                          ))}
                      </div>
                    ))}
                  </fieldset>
                  {stale && (
                    <p role="status" className="text-sm text-warn">
                      You edited the CV after this review. Review again before
                      applying the fixes.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-md text-[13px] text-muted">
                      {variant
                        ? "Fixes change only this variant. To improve every future application, review your base CV."
                        : "Fixes show up in the form with Was, Revert and Keep. They only change this CV: variants you already made stay as they are."}
                    </p>
                    <button
                      type="button"
                      className="btn-primary min-h-12 px-5"
                      onClick={async () => {
                        if (await revise({ suggestions: ticked }))
                          setResult({ ...result, applied: ticked.length });
                      }}
                      disabled={busy || stale || ticked.length === 0}
                    >
                      {revising
                        ? "Applying… (can take a minute)"
                        : ticked.length
                          ? `Apply ${plural(ticked.length, "fix", "fixes")} →`
                          : "Nothing to apply"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {todos.length > 0 && (
            <section aria-labelledby="yours-h" className="flex flex-col gap-2">
              <SectionHeading id="yours-h" count={todos.length}>
                Needs your input
              </SectionHeading>
              <p className="text-[13px] text-muted">
                Only you know these. They stay on their place in the form until
                you mark them done.
              </p>
              {todos.map((todo, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border border-line bg-canvas px-3 py-2.5"
                >
                  <span className="flex min-w-0 flex-[1_1_300px] flex-col">
                    <span className="text-[13px] text-muted">
                      {sectionLabel(content, todo)}
                    </span>
                    <SuggestionText suggestion={todo} />
                  </span>
                  <button
                    type="button"
                    className="btn-secondary min-h-10"
                    onClick={() => goTo(todo.area, todo.entryId)}
                  >
                    Go to field
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

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
              Add something only you know, or ask for a one-off change
              <textarea
                rows={3}
                className="textarea"
                value={instruction}
                onChange={(e) => {
                  setInstruction(e.target.value);
                  setAsked(false);
                }}
                disabled={busy}
                placeholder="e.g. Payouts got 40% faster after the ledger redesign."
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
            {asked && (
              <p role="status" className="text-sm">
                Done, highlighted in the form. Ask for something else, or close
                the panel to see the preview.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex-[1_1_280px] text-[13px] text-muted">
                Uses the model above. Sent with your CV, never your contact
                details.
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  if (!(await revise({ instruction }, masks))) return;
                  setInstruction("");
                  setSendAsWritten([]);
                  setAsked(true);
                }}
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

/** Labelled here, from the entry id the model returned, so headings always match the form. */
function sectionLabel(content: CvContent, { area, entryId }: Todo) {
  if (area === "headline" || area === "summary" || area === "whole")
    return AREA_LABELS[area];
  const entry = (content[area] as { id: string }[]).find(
    (e) => e.id === entryId,
  );
  const name = entry && entryName(entry);
  if (!name) return AREA_LABELS[area];
  return area === "skills" ? `Skills · ${name}` : name; // a group name alone ("Backend") reads like a role
}

/** "Can be fixed for you · 5" */
function SectionHeading({
  id,
  count,
  children,
}: {
  id: string;
  count: number;
  children: string;
}) {
  return (
    <h3 id={id} className="border-b-2 border-ink pb-1.5 text-[17px] font-bold">
      {children} <span className="font-medium text-muted">· {count}</span>
    </h3>
  );
}

/** The problem, how to fix it, and the checklist rule it comes from. */
function SuggestionText({ suggestion }: { suggestion: Todo }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-1">
      <span className="flex min-w-0 flex-[1_1_260px] flex-col">
        <span className="font-semibold">{suggestion.problem}</span>
        <span className="text-[13px] text-muted">{suggestion.detail}</span>
      </span>
      <span className="flex-none rounded-full border border-field px-2 text-xs font-semibold text-subtle">
        {suggestion.rule}
      </span>
    </span>
  );
}
