"use client";

import { useState, useTransition } from "react";
import { saveChecklistAction } from "@/app/actions";
import { DEFAULT_CHECKLIST } from "@/lib/cv/checklist";
import type { ChecklistRule } from "@/lib/cv/schema";

/**
 * "What the review checks": the user's checklist, shown before a review runs. Edit turns it into one
 * name and text box per rule; Done saves it for every CV.
 */
export function Checklist({
  rules,
  disabled,
  onEditing,
}: {
  rules: ChecklistRule[];
  disabled: boolean;
  /** Whether there are edits not saved yet. */
  onEditing: (editing: boolean) => void;
}) {
  const [draft, setDraftState] = useState<ChecklistRule[]>();
  const setDraft = (next: ChecklistRule[] | undefined) => {
    setDraftState(next);
    onEditing(!!next);
  };
  const [error, setError] = useState<string>();
  const [saving, startSave] = useTransition();
  const change = (i: number, rule: Partial<ChecklistRule>) =>
    setDraft(draft?.map((r, j) => (j === i ? { ...r, ...rule } : r)));

  const save = () =>
    startSave(async () => {
      if (!draft) return;
      const result = await saveChecklistAction(draft);
      if (result) return setError(result.error);
      setError(undefined);
      setDraft(undefined); // the page passes the saved list back down
    });

  return (
    <section aria-labelledby="checklist-h" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-canvas px-4 py-3">
        <h3 id="checklist-h" className="text-[15px] font-bold">
          What the review checks
        </h3>
        {draft ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-link"
              onClick={() => setDraft(DEFAULT_CHECKLIST)}
              disabled={saving}
            >
              Reset to default
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setDraft(undefined);
                setError(undefined);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Done"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setDraft(rules)}
            disabled={disabled}
          >
            Edit
          </button>
        )}
      </div>

      {draft ? (
        <div className="flex flex-col gap-3 px-4 py-3">
          {draft.map((rule, i) => (
            <fieldset key={i} className="flex items-start gap-2">
              <legend className="sr-only">Rule {i + 1}</legend>
              <div className="grid flex-1 grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-2">
                <label className="label">
                  Name
                  <input
                    className="input"
                    value={rule.name}
                    onChange={(e) => change(i, { name: e.target.value })}
                  />
                </label>
                <label className="label">
                  Rule
                  <textarea
                    rows={3}
                    className="textarea field-sizing-content"
                    value={rule.text}
                    onChange={(e) => change(i, { text: e.target.value })}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn-link mt-6 text-muted"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() => setDraft(draft.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="btn-link self-start"
            onClick={() => setDraft([...draft, { name: "", text: "" }])}
          >
            + Add a rule
          </button>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <p className="text-[13px] text-muted">
            Saved for every CV, and sent to the model as written. Apply, Ask for
            something else and Tighten to fit follow the same list.
          </p>
        </div>
      ) : (
        <ol className="flex list-decimal flex-col gap-2 py-3 pr-4 pl-9 text-sm">
          {rules.map((rule) => (
            <li key={rule.name}>
              <strong>{rule.name}.</strong> {rule.text}
            </li>
          ))}
        </ol>
      )}

      <p className="flex items-start gap-2.5 border-t border-line px-4 py-3 text-[13px] text-subtle">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="mt-px flex-none"
        >
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span>
          <strong>Always on:</strong> the model never adds employers, titles,
          dates, skills, numbers or achievements your CV doesn&apos;t have.
          Anything new is flagged for you.
        </span>
      </p>
    </section>
  );
}
