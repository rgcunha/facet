"use client";

import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  entryKey,
  keepChange,
  NO_CHANGES,
  orderKey,
  revertAll,
  revertChange,
} from "@/lib/cv/changes";
import { entryValues, joinFilled, plural } from "@/lib/cv/format";
import type { EditorValues, Job, ListSection } from "@/lib/cv/schema";

/** Tracked changes (from tailoring or "Tighten to fit") and the actions on them; autosave persists both. */
export function useChanges() {
  const { getValues, setValue } = useFormContext<EditorValues>();
  const changes = useWatch<EditorValues, "changes">({ name: "changes" });
  return {
    ...changes,
    count: Object.keys(changes.original).length,
    /** Puts back what was there before this change. */
    revert(key: string) {
      const result = revertChange(
        getValues("content"),
        getValues("changes"),
        key,
      );
      setValue(
        `content.${result.field}`,
        result.content[result.field] as never,
      );
      setValue("changes", result.changes);
    },
    /** Accepts the change: it stops being highlighted. */
    keep: (key: string) =>
      setValue("changes", keepChange(getValues("changes"), key)),
    revertAll() {
      setValue(
        "content",
        revertAll(getValues("content"), getValues("changes")),
      );
      setValue("changes", NO_CHANGES);
    },
    keepAll: () => setValue("changes", NO_CHANGES),
  };
}

/** One tracked change: a highlighted note with Revert and Keep. */
function ChangeRow({
  changeKey,
  label,
  revertLabel = "Revert",
  children,
}: {
  changeKey: string;
  label: string;
  revertLabel?: string;
  children?: ReactNode;
}) {
  const { revert, keep } = useChanges();
  return (
    <div className="flex flex-col gap-1 rounded-md bg-accent-soft px-3 py-1.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-accent-strong">{label}</strong>
        <span className="flex min-w-0 flex-1 gap-1">{children}</span>
        <button
          type="button"
          className="btn-link min-h-8 text-sm"
          onClick={() => revert(changeKey)}
        >
          {revertLabel}
        </button>
        <button
          type="button"
          className="btn-link min-h-8 text-sm text-muted"
          onClick={() => keep(changeKey)}
        >
          Keep
        </button>
      </div>
    </div>
  );
}

export function ChangesBanner({ job }: { job: Job | null }) {
  const { count, revertAll, keepAll } = useChanges();
  if (!count) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-accent-soft px-4 py-3 text-sm"
    >
      <span className="flex-[1_1_360px]">
        <strong>
          {job
            ? `Tailored for ${joinFilled([job.title, job.company])}`
            : "Shortened to fit"}
          :
        </strong>{" "}
        {plural(count, "change")}, highlighted below. Edit anything, or revert
        or keep each change.
      </span>
      <button
        type="button"
        className="btn-secondary min-h-9"
        onClick={revertAll}
      >
        Revert all
      </button>
      <button type="button" className="btn-link min-h-9" onClick={keepAll}>
        Keep all
      </button>
    </div>
  );
}

/** Facts the model added that the base CV doesn't contain. Shown only when there are some. */
export function FabricationWarnings() {
  const { flags, revert, keep } = useChanges();
  if (!flags.length) return null;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-warn bg-warn-soft px-4 py-3 text-sm text-warn"
    >
      {flags.map((f) => (
        <div key={f.key} className="flex flex-wrap items-center gap-2">
          <span className="flex-1">
            <strong>Not in your base CV:</strong> {f.facts.join(", ")}. Keep it
            only if it’s true.
          </span>
          <button
            type="button"
            className="btn-link min-h-8 text-sm"
            onClick={() => revert(f.key)}
          >
            Revert
          </button>
          <button
            type="button"
            className="btn-link min-h-8 text-sm text-muted"
            onClick={() => keep(f.key)}
          >
            Keep
          </button>
        </div>
      ))}
    </div>
  );
}

/** "Was: …" under the headline or the summary. */
export function FieldChange({ field }: { field: "headline" | "summary" }) {
  const { original } = useChanges();
  if (!(field in original)) return null;
  return (
    <ChangeRow changeKey={field} label="Changed">
      <span className="truncate text-muted">
        Was:{" "}
        <span className="line-through">
          {String(original[field]) || "(empty)"}
        </span>
      </span>
    </ChangeRow>
  );
}

/** Inside a changed or added entry: what it was, with Revert / Keep. */
export function EntryChange({
  section,
  id,
}: {
  section: ListSection;
  id: string;
}) {
  const { original } = useChanges();
  const key = entryKey(section, id);
  if (!(key in original)) return null;
  const previous = original[key];
  if (previous === null)
    return (
      <ChangeRow
        changeKey={key}
        label="Added by tailoring"
        revertLabel="Remove"
      />
    );
  return (
    <ChangeRow changeKey={key} label="Changed">
      <details className="min-w-0">
        <summary className="cursor-pointer text-muted">
          Show what it was
        </summary>
        <ul className="mt-1 list-disc pl-5 text-subtle">
          {entryValues(previous as object).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </ChangeRow>
  );
}

/** Entries the change removed, and whether the order changed, for one section. */
export function SectionChanges({
  section,
  currentIds,
}: {
  section: ListSection;
  currentIds: string[];
}) {
  const { original } = useChanges();
  const removed = Object.entries(original).filter(
    ([key, value]) =>
      key.startsWith(`${section}.`) &&
      key !== orderKey(section) &&
      value !== null &&
      !currentIds.includes(key.slice(section.length + 1)),
  );
  return (
    <>
      {orderKey(section) in original && (
        <ChangeRow
          changeKey={orderKey(section)}
          label="Reordered"
          revertLabel="Restore order"
        />
      )}
      {removed.map(([key, value]) => (
        <ChangeRow
          key={key}
          changeKey={key}
          label="Removed:"
          revertLabel="Restore"
        >
          <span className="truncate line-through">
            {entryValues(value as object)
              .slice(0, 3)
              .join(" · ")}
          </span>
        </ChangeRow>
      ))}
    </>
  );
}
