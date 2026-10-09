"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useWatch } from "react-hook-form";
import type { EditorValues, Suggestion, Todo } from "@/lib/cv/schema";
import { hasPlace } from "@/lib/cv/todos";

export const TodosContext = createContext<{
  todos: Todo[];
  done: (todo: Todo) => void;
}>({ todos: [], done: () => {} });

/**
 * The CV's to-dos for one place in the form. The whole CV also takes those whose entry was deleted
 * since the review, so every to-do shows somewhere and can be marked done.
 */
export function useTodos(
  area: Suggestion["area"],
  entryId: string | null = null,
) {
  const { todos, done } = useContext(TodosContext);
  const content = useWatch<EditorValues, "content">({
    name: "content",
    disabled: area !== "whole",
  });
  return {
    mine: todos.filter((t) =>
      area === "whole"
        ? t.area === "whole" || !hasPlace(content, t)
        : t.area === area && t.entryId === entryId,
    ),
    done,
  };
}

const anchorId = (area: Suggestion["area"], entryId: string | null) =>
  entryId ? `todo-${area}-${entryId}` : `todo-${area}`;

/**
 * Scrolls to a to-do's place in the form, opening its entry if it's collapsed, and puts the cursor in
 * the entry's (or headline's, or summary's) first field. A to-do about a whole section only scrolls
 * there. An entry that no longer exists falls back to its section.
 */
export function goTo(area: Suggestion["area"], entryId: string | null) {
  const spot =
    document.getElementById(anchorId(area, entryId)) ??
    document.getElementById(anchorId(area, null));
  if (!spot) return;
  const entry = spot.closest("details");
  if (entry) entry.open = true; // its onToggle updates the form's state
  const target = entry ?? spot;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target
    .querySelector<HTMLElement>("input, textarea")
    ?.focus({ preventScroll: true });
}

/**
 * One place a review's to-dos can point to (an entry, a section, the headline, the summary or the
 * whole CV): the anchor Go to field scrolls to, the fields around it, and the notes, each with Done.
 */
export function TodoSpot({
  area,
  entryId = null,
  children,
}: {
  area: Suggestion["area"];
  entryId?: string | null;
  children?: ReactNode;
}) {
  const { mine, done } = useTodos(area, entryId);
  return (
    <div
      id={anchorId(area, entryId)}
      className="flex flex-col gap-3 empty:hidden"
    >
      {children}
      {mine.map((todo, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-dashed border-muted bg-canvas px-3 py-2 text-sm"
        >
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
            className="flex-none text-muted"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
          <span className="min-w-0 flex-[1_1_260px]">
            <strong>To do · {todo.rule}:</strong>{" "}
            {todo.problem.replace(/[.!?]$/, "")}.{" "}
            <span className="text-muted">{todo.detail}</span>
          </span>
          <button
            type="button"
            className="btn-secondary min-h-10"
            onClick={() => done(todo)}
          >
            Done
          </button>
        </div>
      ))}
    </div>
  );
}
