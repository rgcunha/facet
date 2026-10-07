import { describe, expect, test } from "bun:test";
import {
  diffContent,
  findFabrications,
  keepChange,
  NO_CHANGES,
  recordChanges,
  revertAll,
  revertChange,
} from "./changes";
import { emptyContent } from "./empty";
import type { Changes, CvContent } from "./schema";

const role = (
  id: string,
  company: string,
  highlights: string[],
  start = "2020",
) => ({
  id,
  role: "Engineer",
  company,
  location: "",
  start,
  end: "",
  highlights,
});

const base: CvContent = {
  ...emptyContent(),
  headline: "Backend Engineer",
  summary: "Builds payment systems.",
  experience: [
    role("a", "Orbital Pay", ["Led a team"]),
    role("b", "Lumen Health", ["Built APIs"]),
  ],
  skills: [{ id: "s", group: "Platform", items: ["Kubernetes", "Kafka"] }],
  projects: [{ id: "p", name: "Ledger", link: "", description: "" }],
};

// A tailoring: headline rephrased, roles reordered, one highlight reworded,
// a skill added (not in the base!), a project removed and a new role invented.
const tailored: CvContent = {
  ...base,
  headline: "Platform Engineer",
  experience: [
    role("b", "Lumen Health", ["Built APIs"]),
    role("a", "Orbital Pay", ["Led a team of five on Kubernetes"]),
    role("x", "Acme Corp", ["Invented"], "2015"),
  ],
  skills: [
    {
      id: "s",
      group: "Platform",
      items: ["Kubernetes", "Kafka", "Terraform Cloud"],
    },
  ],
  projects: [],
};

describe("diffContent / revert", () => {
  const original = diffContent(base, tailored);

  test("records changed, added, removed and reordered parts", () => {
    expect(Object.keys(original).sort()).toEqual(
      [
        "experience.a",
        "experience.order",
        "experience.x",
        "headline",
        "projects.p",
        "skills.s",
      ].sort(),
    );
    expect(original["experience.x"]).toBeNull();
    expect(original["experience.order"]).toEqual(["a", "b"]);
  });

  test("reverting each change one by one restores the base exactly", () => {
    let state: { content: CvContent; changes: Changes } = {
      content: tailored,
      changes: { original, flags: [] },
    };
    for (const key of [
      "experience.x",
      "projects.p",
      "skills.s",
      "experience.a",
      "headline",
      "experience.order",
    ])
      state = revertChange(state.content, state.changes, key);
    expect(state.content).toEqual(base);
    expect(state.changes).toEqual(NO_CHANGES);
  });

  test("revertAll restores the base", () => {
    expect(revertAll(tailored, { original, flags: [] })).toEqual(base);
  });

  test("recordChanges keeps the earliest version and the user's decisions across rounds", () => {
    const first = recordChanges(NO_CHANGES, base, tailored, base);
    expect(first.flags.map((f) => f.key)).toEqual(["experience.x", "skills.s"]);
    // The user keeps the invented role, then a second round edits the headline again.
    const kept = keepChange(first, "experience.x");
    const second = recordChanges(
      kept,
      tailored,
      { ...tailored, headline: "SRE" },
      base,
    );
    expect(second.original.headline).toBe("Backend Engineer");
    expect(second.flags.map((f) => f.key)).toEqual(["skills.s"]);
    expect(revertAll({ ...tailored, headline: "SRE" }, second).headline).toBe(
      "Backend Engineer",
    );
  });
});

describe("findFabrications", () => {
  test("flags facts that appear nowhere in the base CV, per changed entry", () => {
    const flags = findFabrications(
      [base],
      tailored,
      diffContent(base, tailored),
    );
    expect(flags).toEqual([
      { key: "experience.x", facts: ["Acme Corp", "2015"] },
      { key: "skills.s", facts: ["Terraform Cloud"] },
    ]);
  });

  test("rephrasing and reordering existing facts is not flagged", () => {
    const reordered = { ...base, experience: [...base.experience].reverse() };
    expect(
      findFabrications([base], reordered, diffContent(base, reordered)),
    ).toEqual([]);
  });

  test("a translated variant is only checked on language-neutral facts", () => {
    const german = {
      ...tailored,
      experience: tailored.experience.map((e) => ({ ...e, role: "Ingenieur" })),
    };
    const flags = findFabrications([base], german, diffContent(base, german), {
      translated: true,
    });
    expect(flags).toEqual([
      { key: "experience.x", facts: ["Acme Corp", "2015"] },
      { key: "skills.s", facts: ["Terraform Cloud"] },
    ]);
  });

  test("a fact the user kept is not flagged again in a later round", () => {
    const kept = keepChange(
      recordChanges(NO_CHANGES, base, tailored, base),
      "experience.x",
    );
    const tightened = {
      ...tailored,
      experience: tailored.experience.map((e) => ({
        ...e,
        highlights: e.highlights.slice(0, 1),
      })),
    };
    const next = recordChanges(
      kept,
      tailored,
      { ...tightened, headline: "SRE" },
      base,
    );
    expect(next.flags.map((f) => f.key)).toEqual(["skills.s"]);
  });

  test("flags a number the base CV doesn't have, in free text too", () => {
    const reviewed = {
      ...base,
      summary: "Builds payment systems for 3 teams.",
      experience: [
        role("a", "Orbital Pay", ["Led a team, cutting latency by 40%"]),
        role("b", "Lumen Health", ["Built APIs since 2020"]),
      ],
    };
    expect(
      findFabrications([base], reviewed, diffContent(base, reviewed)),
    ).toEqual([
      { key: "summary", facts: ["3 teams"] },
      { key: "experience.a", facts: ["40%"] },
    ]);
  });

  test("digits inside names like S3 or EC2 aren't numbers", () => {
    const after = {
      ...base,
      experience: [role("a", "Orbital Pay", ["Moved files to S3 on EC2"])],
    };
    expect(findFabrications([base], after, diffContent(base, after))).toEqual(
      [],
    );
  });

  test("numbers and facts the user typed in their instruction aren't flagged", () => {
    const after = {
      ...base,
      experience: [
        role("a", "Orbital Pay", ["Cut deploy time from 40 to 5 minutes"]),
      ],
    };
    expect(
      findFabrications([base], after, diffContent(base, after), {
        stated: "Add that I cut deploy time from 40 to 5 minutes",
      }),
    ).toEqual([]);
  });

  test("a new number in an entry already flagged by tailoring is added to its flag", () => {
    const first = recordChanges(NO_CHANGES, base, tailored, base);
    const reviewed = {
      ...tailored,
      experience: tailored.experience.map((e) =>
        e.id === "x" ? { ...e, highlights: ["Invented, 40% faster"] } : e,
      ),
    };
    const next = recordChanges(first, tailored, reviewed, base);
    expect(next.flags.find((f) => f.key === "experience.x")?.facts).toEqual([
      "Acme Corp",
      "2015",
      "40% faster",
    ]);
  });

  test("a number already in the CV, however it's written, is not flagged", () => {
    const before = {
      ...base,
      experience: [role("a", "Orbital Pay", ["Served 1,500 shops"])],
    };
    const after = {
      ...base,
      experience: [role("a", "Orbital Pay", ["Serves 1.500 shops"])],
    };
    expect(
      findFabrications([before], after, diffContent(before, after)),
    ).toEqual([]);
  });
});

test("skills the user confirmed in the match report aren't flagged", () => {
  const tailored: CvContent = {
    ...base,
    skills: [
      {
        id: "s",
        group: "Platform",
        items: ["Kubernetes", "Kafka", "Helm", "Terraform Cloud"],
      },
    ],
  };
  const { flags } = recordChanges(NO_CHANGES, base, tailored, base, {
    knownSkills: ["Helm"],
  });
  expect(flags).toEqual([{ key: "skills.s", facts: ["Terraform Cloud"] }]);
});
