import { expect, test } from "bun:test";
import { diffContent } from "./changes";
import { changeOrder, describeChange, diffWords, type Part } from "./diff";
import { emptyContent } from "./empty";

const text = (parts: Part[], kind: Part["kind"]) =>
  parts.filter((p) => p.kind === kind).map((p) => p.text);

test("diffWords marks words added, removed and kept, merging runs", () => {
  expect(
    diffWords("Senior Backend Engineer", "Senior Platform Engineer"),
  ).toEqual([
    { text: "Senior", kind: "same" },
    { text: "Backend", kind: "removed" },
    { text: "Platform", kind: "added" },
    { text: "Engineer", kind: "same" },
  ]);
  const parts = diffWords(
    "Responsible for the payments API",
    "Own the payments API used by checkout",
  );
  expect(text(parts, "removed")).toEqual(["Responsible for"]);
  expect(text(parts, "added")).toEqual(["Own", "used by checkout"]);
  expect(text(parts, "same")).toEqual(["the payments API"]);
});

test("diffWords handles same text and empty sides", () => {
  expect(diffWords("Led a team", "Led a team")).toEqual([
    { text: "Led a team", kind: "same" },
  ]);
  expect(diffWords("", "New")).toEqual([{ text: "New", kind: "added" }]);
  expect(diffWords("Old", "")).toEqual([{ text: "Old", kind: "removed" }]);
  expect(diffWords("", "")).toEqual([]);
});

const role = {
  id: "e1",
  role: "Backend Engineer",
  company: "Orbital Pay",
  location: "Lisbon",
  start: "2021",
  end: "",
  highlights: [
    "Responsible for the payments API",
    "Ran on-call for payments",
    "Mentored two engineers",
  ],
};
const before = {
  ...emptyContent(),
  headline: "Backend Engineer",
  experience: [role],
};

test("a changed entry shows only its changed fields, a rewritten bullet as a word diff", () => {
  const after = {
    ...before,
    experience: [
      {
        ...role,
        role: "Platform Engineer",
        highlights: [
          "Mentored two engineers",
          "Own the payments API",
          "Ran on-call for payments",
        ],
      },
    ],
  };
  const original = diffContent(before, after);
  const view = describeChange("experience.e1", original, after);

  expect(view.where).toBe("Experience · Orbital Pay");
  expect(view.note).toBe("2 bullets unchanged");
  expect(view.lines.map((l) => l.label)).toEqual([
    "Role",
    "Bullets reordered",
    "Bullet 2",
  ]);
  expect(text(view.lines[2].parts, "removed")).toEqual(["Responsible for"]);
  expect(text(view.lines[2].parts, "added")).toEqual(["Own"]);
});

test("a rewrite sharing too few words shows the old text, then the new one", () => {
  const after = { ...before, headline: "Ingeniero de plataformas" };
  const view = describeChange(
    "headline",
    { headline: "Backend Engineer" },
    after,
  );
  expect(view.lines[0].parts).toEqual([
    { text: "Backend Engineer", kind: "removed" },
    { text: "Ingeniero de plataformas", kind: "added" },
  ]);
});

test("added, removed and reordered entries", () => {
  const other = {
    ...role,
    id: "e2",
    company: "Lumen Health",
    highlights: ["Built a CLI"],
  };
  const withTwo = { ...before, experience: [role, other] };

  const added = describeChange(
    "experience.e2",
    { "experience.e2": null },
    withTwo,
  );
  expect(added).toMatchObject({
    where: "Experience · Lumen Health",
    note: "Added",
  });
  expect(added.lines.every((l) => l.parts[0].kind === "added")).toBe(true);

  const removed = describeChange(
    "experience.e2",
    { "experience.e2": other },
    before,
  );
  expect(removed.note).toBe("Removed");
  expect(removed.lines.map((l) => l.parts[0].text)).toContain("Built a CLI");

  const swapped = { ...before, experience: [other, role] };
  const order = describeChange(
    "experience.order",
    { "experience.order": ["e1", "e2"] },
    swapped,
  );
  expect(order.where).toBe("Experience · order");
  expect(order.lines.map((l) => l.parts[0].text)).toEqual([
    "Orbital Pay · Lumen Health",
    "Lumen Health · Orbital Pay",
  ]);
});

test("the order card names entries removed since, and odd leftovers don't break a card", () => {
  const other = { ...role, id: "e2", company: "Lumen Health" };
  // The model reordered e1/e2 and removed e2.
  const order = describeChange(
    "experience.order",
    { "experience.order": ["e2", "e1"], "experience.e2": other },
    before,
  );
  expect(order.lines[0].parts[0].text).toBe("Lumen Health · Orbital Pay");

  // An entry the model added, gone from the form since.
  expect(
    describeChange("experience.e9", { "experience.e9": null }, before),
  ).toMatchObject({
    where: "Experience",
    note: "Added, then removed",
    lines: [],
  });
  // A changed entry edited back to what it was.
  expect(
    describeChange("experience.e1", { "experience.e1": role }, before),
  ).toMatchObject({ note: "Edited back to what it was", lines: [] });
});

test("cards follow the CV: headline, summary, then sections with their order last", () => {
  expect(
    changeOrder([
      "skills.s1",
      "experience.order",
      "summary",
      "experience.e1",
      "headline",
    ]),
  ).toEqual([
    "headline",
    "summary",
    "experience.e1",
    "experience.order",
    "skills.s1",
  ]);
});
