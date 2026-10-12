"use client";

import { createContext, use } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  keepChange,
  NO_CHANGES,
  orderKey,
  parseChangeKey,
  revertAll,
  revertChange,
} from "@/lib/cv/changes";
import { entryName, joinFilled, plural } from "@/lib/cv/format";
import type { EditorValues, Job, ListSection, Run } from "@/lib/cv/schema";
import { RunInfo } from "@/components/model";

/** Tracked changes (from tailoring, a review or "Tighten to fit") and the actions on them; autosave persists both. */
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
    /** Accepts the change: it stops being tracked. */
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

/** Opens the Changes tab, at one change's card when given its key. */
export const ShowChange = createContext<(key?: string) => void>(() => {});

/** Marks a changed spot in the form; it opens the change's card, where it is kept or reverted. */
export function ChangedBadge({
  changeKey,
  label = "Changed",
}: {
  changeKey: string;
  label?: string;
}) {
  const show = use(ShowChange);
  return (
    <button
      type="button"
      className="min-h-8 shrink-0 rounded bg-accent-soft px-2 text-[13px] font-semibold text-accent-strong hover:bg-accent hover:text-white"
      onClick={(e) => {
        e.preventDefault(); // inside an entry's <summary>, don't fold it
        show(changeKey);
      }}
    >
      {label}
    </button>
  );
}

/** Under the headline or the summary, when the model changed it. */
export function FieldChange({ field }: { field: "headline" | "summary" }) {
  const { original } = useChanges();
  if (!(field in original)) return null;
  return (
    <div className="-mt-1.5">
      <ChangedBadge changeKey={field} label="Changed: review it" />
    </div>
  );
}

export function ChangesBanner({
  job,
  run,
}: {
  job: Job | null;
  /** The last model call that changed this CV (changes can add up over several). */
  run: Run | null;
}) {
  const { count, flags } = useChanges();
  const show = use(ShowChange);
  if (!count) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-accent-soft px-4 py-3 text-sm"
    >
      <span className="flex-[1_1_360px]">
        <strong>
          {job
            ? `Variant for ${joinFilled([job.title, job.company])}`
            : "Edited by the model"}
          :
        </strong>{" "}
        {plural(count, "change")} to review.
        {flags.length > 0 && (
          <strong className="text-warn">
            {" "}
            {plural(flags.length, "change adds", "changes add")} something that
            isn’t in your base CV: check before you export.
          </strong>
        )}
        {run && (
          <>
            {" "}
            Last run: <RunInfo run={run} />.
          </>
        )}
      </span>
      <button
        type="button"
        className="btn-secondary min-h-9"
        onClick={() => show()}
      >
        Review changes
      </button>
    </div>
  );
}

/** At the end of a section: entries the model removed, and whether it reordered them. */
export function SectionChanges({
  section,
  currentIds,
}: {
  section: ListSection;
  currentIds: string[];
}) {
  const { original } = useChanges();
  const removed = Object.entries(original).filter(([key, value]) => {
    const { field, id } = parseChangeKey(key);
    return (
      field === section &&
      id !== "order" &&
      value !== null &&
      !currentIds.includes(id)
    );
  });
  if (!removed.length && !(orderKey(section) in original)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {orderKey(section) in original && (
        <ChangedBadge changeKey={orderKey(section)} label="Reordered" />
      )}
      {removed.map(([key, value]) => (
        <ChangedBadge
          key={key}
          changeKey={key}
          label={`Removed: ${entryName(value as Record<string, unknown>) || "an entry"}`}
        />
      ))}
    </div>
  );
}
