import { type CvContent, LIST_SECTIONS, type Todo } from "./schema";

/** Whether a to-do's place is in the CV: its entry exists, or it isn't about one entry. */
export function hasPlace(content: CvContent, { area, entryId }: Todo) {
  const section = LIST_SECTIONS.find((s) => s === area);
  return (
    !section ||
    entryId === null ||
    content[section].some((entry) => entry.id === entryId)
  );
}

/**
 * Pins each to-do to a place the form shows: an entry the CV doesn't have (or an entry id on the
 * headline, summary or whole CV) becomes a note on its section instead.
 */
export const placeTodos = (content: CvContent, todos: Todo[]) =>
  todos.map((todo) =>
    hasPlace(content, todo) &&
    (todo.entryId === null || LIST_SECTIONS.some((s) => s === todo.area))
      ? todo
      : { ...todo, entryId: null },
  );

export const sameTodo = (a: Todo, b: Todo) =>
  JSON.stringify(a) === JSON.stringify(b);
