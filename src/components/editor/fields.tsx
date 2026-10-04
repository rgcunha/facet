"use client";

import { type ReactNode, useState } from "react";
import {
  type FieldPath,
  type FieldPathByValue,
  useController,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { blankItem } from "@/lib/cv/empty";
import { joinFilled } from "@/lib/cv/format";
import type { CvContent, EditorValues } from "@/lib/cv/schema";

type StringListPath = FieldPathByValue<EditorValues, string[]>;

export function Card({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      {children}
    </div>
  );
}

export function TextField({
  name,
  label,
  rows,
}: {
  name: FieldPath<EditorValues>;
  label: string;
  rows?: number;
}) {
  const { register } = useFormContext<EditorValues>();
  return (
    <label className="label">
      {label}
      {rows ? (
        <textarea rows={rows} className="textarea" {...register(name)} />
      ) : (
        <input className="input" {...register(name)} />
      )}
    </label>
  );
}

/** One input per entry, e.g. the highlights of a role. */
export function StringListField({
  name,
  label,
  addLabel,
  itemActions,
}: {
  name: StringListPath;
  label: string;
  addLabel: string;
  /** Extra controls per entry, e.g. "Move to…" for a role's highlights. */
  itemActions?: (index: number) => ReactNode;
}) {
  const { field } = useController<EditorValues, StringListPath>({ name });
  const items = field.value;
  const set = (next: string[]) => field.onChange(next);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] text-muted">{label}</legend>
      {items.map((value, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="input"
            aria-label={`${label} ${i + 1}`}
            value={value}
            onChange={(e) =>
              set(items.map((v, j) => (j === i ? e.target.value : v)))
            }
          />
          <button
            type="button"
            className="btn-link text-muted"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            onClick={() => set(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
          {itemActions?.(i)}
        </div>
      ))}
      <button
        type="button"
        className="btn-link self-start"
        onClick={() => set([...items, ""])}
      >
        + {addLabel}
      </button>
    </fieldset>
  );
}

/**
 * Moves one highlight to another role, for fixing a parse that put bullets under the wrong job.
 * The role list is read when the menu is focused, so typing elsewhere doesn't re-render it.
 */
export function MoveToRole({
  role,
  highlight,
}: {
  role: number;
  highlight: number;
}) {
  const { getValues, setValue } = useFormContext<EditorValues>();
  const [targets, setTargets] = useState<{ index: number; label: string }[]>(
    [],
  );

  const loadTargets = () =>
    setTargets(
      getValues("content.experience").flatMap((r, index) =>
        index === role
          ? []
          : [
              {
                index,
                label: joinFilled([r.role, r.company]) || `Role ${index + 1}`,
              },
            ],
      ),
    );

  const move = (target: number) => {
    const roles = getValues("content.experience");
    const text = roles[role].highlights[highlight];
    setValue(
      `content.experience.${role}.highlights`,
      roles[role].highlights.filter((_, i) => i !== highlight),
    );
    setValue(`content.experience.${target}.highlights`, [
      ...roles[target].highlights,
      text,
    ]);
  };

  return (
    <select
      aria-label={`Move highlight ${highlight + 1} to another role`}
      className="input w-auto max-w-44 text-sm text-muted"
      value=""
      onFocus={loadTargets}
      onChange={(e) => move(Number(e.target.value))}
    >
      <option value="" disabled>
        Move to…
      </option>
      {targets.map((t) => (
        <option key={t.index} value={t.index}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

/** Comma-separated entries in a single input, e.g. the skills of a group. Raw text is kept; the template trims. */
export function CommaListField({
  name,
  label,
}: {
  name: StringListPath;
  label: string;
}) {
  const { field } = useController<EditorValues, StringListPath>({ name });
  return (
    <label className="label">
      {label}
      <input
        className="input"
        value={field.value.join(",")}
        onChange={(e) => field.onChange(e.target.value.split(","))}
      />
    </label>
  );
}

type ListKey = keyof typeof blankItem;
type Item<K extends ListKey> = CvContent[K][number];
// Every entry has our own `id`; RHF's generic field type for an unresolved K just can't show it.
const entryId = (field: object) => (field as { id: string }).id;

/** Watches only its own entry, so typing re-renders this line, not the whole section. */
function EntrySummary<K extends ListKey>(props: {
  path: `content.${K}.${number}`;
  summary: (item: Item<K>) => string;
}) {
  const item = useWatch<EditorValues>({ name: props.path }) as Item<K>;
  return (
    <span className="min-w-0 flex-1 truncate font-semibold">
      {props.summary(item) || "New entry"}
    </span>
  );
}

/** A section whose entries can be added, collapsed, reordered and removed. */
export function ItemList<K extends ListKey>(props: {
  section: K;
  title: string;
  addLabel: string;
  summary: (item: Item<K>) => string;
  children: (path: `content.${K}.${number}`, index: number) => ReactNode;
}) {
  const { section, title, addLabel, summary, children } = props;
  const name = `content.${section}` as const;
  // keyName "fieldKey" keeps RHF's internal key from overwriting our own `id`.
  const { fields, append, remove, move } = useFieldArray<
    EditorValues,
    typeof name,
    "fieldKey"
  >({ name, keyName: "fieldKey" });
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const setOpen = (id: string, open: boolean) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  const add = () => {
    const item = blankItem[section]();
    // TS can't relate blankItem[K]'s return type to RHF's generic field-array item type.
    append(item as never);
    setOpen(item.id, true);
  };

  return (
    <Card
      title={title}
      aside={
        <button type="button" className="btn-link" onClick={add}>
          + {addLabel}
        </button>
      }
    >
      {fields.length === 0 && (
        <p className="text-sm text-muted">Nothing here yet.</p>
      )}
      {fields.map((f, i) => (
        <details
          key={f.fieldKey}
          open={openIds.has(entryId(f))}
          onToggle={(e) => setOpen(entryId(f), e.currentTarget.open)}
          className="rounded-lg border border-line"
        >
          <summary className="flex min-h-12 cursor-pointer items-center px-3">
            <EntrySummary<K> path={`${name}.${i}`} summary={summary} />
          </summary>
          <div className="flex flex-col gap-3 border-t border-line p-3">
            {children(`${name}.${i}`, i)}
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="btn-link"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="btn-link"
                disabled={i === fields.length - 1}
                onClick={() => move(i, i + 1)}
              >
                Move down
              </button>
              <button
                type="button"
                className="btn-link ml-auto text-danger hover:text-danger"
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </div>
          </div>
        </details>
      ))}
    </Card>
  );
}
