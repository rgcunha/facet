import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import type { PrivateValue } from "@/lib/cv/schema";
import { z } from "zod";
import { emptyContent } from "@/lib/cv/empty";
import { privateValuesOf } from "@/lib/privacy/values";
import { modelContentSchema } from "./content";
import { analyzeCv } from "./analyze";
import { generateStructured } from "./generate";
import { reviewCv } from "./review";
import { applyInstruction, reviseCv } from "./revise";
import { structureCv } from "./structure";
import { tailorCv } from "./tailor";

const privateValues: PrivateValue[] = [
  { kind: "name", value: "Alex Moreno" },
  { kind: "email", value: "alex.moreno@example.com" },
  { kind: "phone", value: "+351 912 000 000" },
  { kind: "url", value: "github.com/alexmoreno" },
];

const cvText = `Alex Moreno
Senior Backend Engineer
alex.moreno@example.com · +351 912 000 000 · github.com/alexmoreno
SUMMARY
Backend engineer. Alex Moreno likes Go.
EXPERIENCE
Lead Backend Engineer, Orbital Pay · 2021 – Present
• Led the settlement team.
PROJECTS
Ledger tool — github.com/alexmoreno`;

/** A provider stand-in that records exactly what would have been sent and answers with fixed JSON. */
function recordingModel(answer: object) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

test("no private value reaches the provider, and placeholders come back as real values", async () => {
  const model = recordingModel({
    language: "en",
    headline: "Senior Backend Engineer",
    summary: "Backend engineer. {{NAME}} likes Go.",
    experience: [
      {
        role: "Lead Backend Engineer",
        company: "Orbital Pay",
        location: "",
        start: "2021",
        end: "Present",
        highlights: ["Led the settlement team."],
      },
    ],
    education: [],
    skills: [],
    projects: [{ name: "Ledger tool", link: "{{URL}}", description: "" }],
    languages: [],
    extras: [],
  });

  const { content } = await structureCv(cvText, privateValues, model);

  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of privateValues) expect(sent).not.toContain(value);
  expect(sent).toContain("{{NAME}}");
  expect(content.projects[0].link).toBe("github.com/alexmoreno");
  expect(content.summary).toBe("Backend engineer. Alex Moreno likes Go.");
  expect(content.experience[0].id).toMatch(/^[0-9a-f]{8}$/);
});

test("a reformatted phone number is masked, never sent", async () => {
  const model = recordingModel({ ...emptyContent(), language: "en" });
  await structureCv(
    "Call 00351-912-000-000",
    [{ kind: "phone", value: "+351 912 000 000" }],
    model,
  );
  const sent = JSON.stringify(model.doGenerateCalls);
  expect(sent).toContain("{{PHONE}}");
  expect(sent.replace(/\D/g, "")).not.toContain("351912000000");
});

test("the guard blocks a private value wherever masking doesn't reach (here: the system prompt)", async () => {
  const model = recordingModel({});
  await expect(
    generateStructured({
      schema: z.object({}),
      system: "Write to alex.moreno@example.com",
      prompt: "Hello",
      privateValues,
      model,
    }),
  ).rejects.toThrow(/email/);
  expect(model.doGenerateCalls).toHaveLength(0);
});

test("tailoring masks the vault everywhere (job text included) and keeps known entry ids", async () => {
  const base = {
    ...emptyContent(),
    headline: "Backend Engineer",
    summary: "Built a ledger.",
    experience: [
      {
        id: "a1b2c3d4",
        role: "Engineer",
        company: "Orbital Pay",
        location: "",
        start: "2021",
        end: "",
        highlights: ["Led a team"],
      },
    ],
    projects: [
      {
        id: "p0000001",
        name: "Ledger",
        link: "github.com/alexmoreno",
        description: "",
      },
    ],
  };
  const model = recordingModel({
    content: {
      ...base,
      headline: "Platform Engineer",
      experience: [
        { ...base.experience[0], id: "a1b2c3d4" },
        { ...base.experience[0], id: "a1b2c3d4", company: "Duplicate id" },
        { ...base.experience[0], id: "made-up", company: "Invented id" },
      ],
      projects: [
        { id: "p0000001", name: "Ledger", link: "{{URL}}", description: "" },
      ],
    },
    job: { title: "Platform Engineer", company: "Halden", language: "en" },
  });

  const result = await tailorCv(
    base,
    "We are hiring. Referrals to Alex Moreno at alex.moreno@example.com.",
    { language: "", pages: 1, report: { confirmed: [], suggestions: [] } },
    privateValues,
    model,
  );

  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of privateValues) expect(sent).not.toContain(value);
  expect(result.content.experience.map((e) => e.id)[0]).toBe("a1b2c3d4");
  expect(new Set(result.content.experience.map((e) => e.id)).size).toBe(3);
  expect(result.content.experience[2].id).not.toBe("made-up");
  expect(result.content.projects[0].link).toBe("github.com/alexmoreno");
});

test("a CV's own contact and vault are masked in tailoring, without being passed separately", async () => {
  const cv = {
    contact: {
      name: "Sam Rivera",
      email: "sam.rivera@example.org",
      phone: "",
      location: "",
      dateOfBirth: "",
      links: [],
    },
    vault: [{ kind: "custom" as const, value: "Orbital Pay Ltd" }],
    content: {
      ...emptyContent(),
      summary: "Sam Rivera built payments at Orbital Pay Ltd.",
    },
  };
  const model = recordingModel({
    content: cv.content,
    job: { title: "Engineer", company: "Halden", language: "en" },
  });

  await tailorCv(
    cv.content,
    "Contact sam.rivera@example.org about this role. ".repeat(5),
    { language: "", pages: 1, report: { confirmed: [], suggestions: [] } },
    privateValuesOf(cv),
    model,
  );

  const sent = JSON.stringify(model.doGenerateCalls);
  for (const value of [
    "Sam Rivera",
    "sam.rivera@example.org",
    "Orbital Pay Ltd",
  ])
    expect(sent).not.toContain(value);
});

test("the schema sent to the model requires every field, so none (like a job's role) is skipped", () => {
  const json = z.toJSONSchema(modelContentSchema("omit"), {
    io: "input",
  }) as unknown as {
    required: string[];
    properties: { experience: { items: { required: string[] } } };
  };
  expect(json.required).toEqual(
    expect.arrayContaining(["headline", "summary", "experience"]),
  );
  expect(json.properties.experience.items.required).toEqual(
    expect.arrayContaining(["role", "company", "start", "end", "highlights"]),
  );
});

test("analysis masks the CV's private values and returns the report", async () => {
  const content = {
    ...emptyContent(),
    summary: "Alex Moreno runs Kubernetes at alex.moreno@example.com.",
  };
  const answer = {
    title: "Platform Engineer",
    yearsRequired: 5,
    requirements: [
      { name: "Kubernetes", synonyms: ["k8s"], priority: "must" },
      { name: "Helm", synonyms: [], priority: "nice" },
    ],
    strengths: ["Runs Kubernetes"],
    gaps: [{ name: "Helm", why: "Kubernetes deployments" }],
    missing: [],
    suggestions: ["Lead with {{NAME}}'s Kubernetes work"],
  };
  const model = recordingModel(answer);

  const report = await analyzeCv(
    content,
    "We need Kubernetes and Helm. Ask Alex Moreno for details.",
    privateValues,
    model,
  );

  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of privateValues) expect(sent).not.toContain(value);
  expect(report.requirements).toHaveLength(2);
  expect(report.suggestions[0]).toBe("Lead with Alex Moreno's Kubernetes work");
});

test("tailoring tells the model which skills the user confirmed", async () => {
  const model = recordingModel({
    content: emptyContent(),
    job: { title: "", company: "", language: "en" },
  });
  await tailorCv(
    emptyContent(),
    "Job text",
    {
      language: "",
      pages: 1,
      report: {
        confirmed: ["Helm"],
        suggestions: ["Use Platform in the headline"],
      },
    },
    [],
    model,
  );
  const sent = JSON.stringify(model.doGenerateCalls);
  expect(sent).toContain("Skills the candidate confirmed having: Helm.");
  expect(sent).toContain("- Use Platform in the headline");
});

test("a review masks the CV's private values and passes on the job's keywords", async () => {
  const model = recordingModel({
    suggestions: [
      {
        area: "summary",
        entryId: null,
        problem: "Names {{NAME}} in the third person",
        detail: "Drop the name.",
        kind: "fix",
      },
    ],
  });
  const suggestions = await reviewCv(
    { ...emptyContent(), summary: "Alex Moreno runs Kubernetes." },
    privateValues,
    { keep: ["Kubernetes"] },
    model,
  );
  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of privateValues) expect(sent).not.toContain(value);
  expect(sent).toContain("Keep these terms wherever they appear");
  expect(suggestions[0].problem).toBe("Names Alex Moreno in the third person");
});

test("revising masks names in the user's instruction as well as the CV, and keeps entry ids", async () => {
  const content = {
    ...emptyContent(),
    summary: "Alex Moreno builds ledgers.",
    projects: [{ id: "p1", name: "Ledger", link: "", description: "" }],
  };
  const model = recordingModel({
    ...content,
    summary: "Builds ledgers with {{NAME_2}}'s team.",
  });
  const colleague: PrivateValue = { kind: "name", value: "Marta Silva" };
  const revised = await reviseCv(
    content,
    "Mention that I built ledgers with Marta Silva's team.",
    [...privateValues, colleague],
    {},
    model,
  );
  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of [...privateValues, colleague])
    expect(sent).not.toContain(value);
  expect(revised.summary).toBe("Builds ledgers with Marta Silva's team.");
  expect(revised.projects[0].id).toBe("p1");
});

test("Apply sends only the fixes, never what only the user can add", () => {
  const instruction = applyInstruction([
    {
      area: "experience",
      entryId: "a",
      problem: "Filler",
      detail: "Cut it.",
      kind: "fix",
    },
    {
      area: "experience",
      entryId: "a",
      problem: "Add a number",
      detail: "How much faster?",
      kind: "yours",
    },
  ]);
  expect(instruction).toContain('- experience entry "a": Filler. Cut it.');
  expect(instruction).not.toContain("Add a number");
});
