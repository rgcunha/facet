import { expect, test } from "bun:test";
import { emptyContent } from "./empty";
import { hasPlace, placeTodos } from "./todos";

const content = {
  ...emptyContent(),
  experience: [
    {
      id: "e1",
      role: "Lead",
      company: "Orbital Pay",
      location: "",
      start: "",
      end: "",
      highlights: [],
    },
  ],
};
const todo = { problem: "Add a number", detail: "How much?", rule: "Impact" };

test("a to-do whose place the form doesn't show moves to its section", () => {
  expect(
    placeTodos(content, [
      { ...todo, area: "experience", entryId: "e1" },
      { ...todo, area: "experience", entryId: "made-up" },
      { ...todo, area: "summary", entryId: "e1" },
    ]).map((t) => [t.area, t.entryId]),
  ).toEqual([
    ["experience", "e1"],
    ["experience", null],
    ["summary", null],
  ]);
});

test("an entry deleted since the review leaves its to-do without a place", () => {
  const t = { ...todo, area: "experience" as const, entryId: "e1" };
  expect(hasPlace(content, t)).toBe(true);
  expect(hasPlace(emptyContent(), t)).toBe(false);
  expect(hasPlace(emptyContent(), { ...t, entryId: null })).toBe(true);
});
