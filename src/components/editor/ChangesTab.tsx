"use client";

import { useDeferredValue } from "react";
import { useWatch } from "react-hook-form";
import { changeOrder, describeChange, type Part } from "@/lib/cv/diff";
import { plural } from "@/lib/cv/format";
import type { EditorValues } from "@/lib/cv/schema";
import { useChanges } from "./changes";

export const changeCardId = (key: string) => `change-${key}`;

const PART_CLASS: Record<Part["kind"], string> = {
  same: "",
  added: "rounded-sm bg-accent-soft px-0.5 text-accent-strong",
  removed: "text-subtle line-through",
};

function Parts({ parts }: { parts: Part[] }) {
  return (
    <p className="leading-relaxed">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className={PART_CLASS[p.kind]}>
            {p.kind !== "same" && (
              <span className="sr-only">
                {p.kind === "added" ? "Added: " : "Removed: "}
              </span>
            )}
            {p.text}
          </span>
        </span>
      ))}
    </p>
  );
}

/**
 * Every tracked change in one list, each with a word-level before → after, to keep or revert.
 * Tailoring, a review's Apply, Ask and Tighten all land here.
 */
export function ChangesTab({ onDone }: { onDone: () => void }) {
  const { original, flags, count, keep, revert, keepAll, revertAll } =
    useChanges();
  // Deferred like the preview, so typing in the form doesn't wait for every card's diff.
  const content = useDeferredValue(
    useWatch<EditorValues, "content">({ name: "content" }),
  );

  if (!count)
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 px-4 py-12 text-center"
      >
        <h2 className="text-lg font-bold">All changes reviewed</h2>
        <p className="text-muted">The preview shows the CV as it is now.</p>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Back to Preview
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex-[1_1_240px] text-lg font-bold">
          {plural(count, "change")} to review
        </h2>
        <button type="button" className="btn-secondary" onClick={revertAll}>
          Revert all
        </button>
        <button type="button" className="btn-secondary" onClick={keepAll}>
          Keep all
        </button>
      </div>
      <p className="-mt-1.5 text-[13px] text-muted">
        <span className={PART_CLASS.removed}>Struck through</span> is what your
        CV had; <span className={PART_CLASS.added}>highlighted</span> is what
        the model wrote.
      </p>
      {changeOrder(Object.keys(original)).map((key) => {
        const view = describeChange(key, original, content);
        const flag = flags.find((f) => f.key === key);
        return (
          <article
            key={key}
            id={changeCardId(key)}
            tabIndex={-1}
            aria-label={view.where}
            className={`flex flex-col gap-2.5 rounded-lg border bg-white px-4 py-3.5 ${flag ? "border-warn" : "border-line"}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h3 className="font-bold">{view.where}</h3>
              {view.note && (
                <span className="text-[13px] text-muted">{view.note}</span>
              )}
            </div>
            {view.lines.map((line, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                {line.label && (
                  <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {line.label}
                  </span>
                )}
                <Parts parts={line.parts} />
              </div>
            ))}
            {flag && (
              <p
                role="alert"
                className="rounded-lg border border-warn bg-warn-soft px-3 py-2 text-sm text-warn"
              >
                <strong>Not in your base CV:</strong> {flag.facts.join(", ")}.
                Keep it only if it’s true.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => revert(key)}
              >
                Revert
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => keep(key)}
              >
                Keep
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
