import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import type { PrivateValue } from "@/lib/cv/schema";
import { z } from "zod";
import { emptyContent } from "@/lib/cv/empty";
import { privateValuesOf } from "@/lib/privacy/values";
import { modelContentSchema } from "./content";
import { generateStructured } from "./generate";
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
    missingKeywords: ["PagerDuty"],
  });

  const result = await tailorCv(
    base,
    "We are hiring. Referrals to Alex Moreno at alex.moreno@example.com.",
    { language: "", pages: 1 },
    privateValues,
    model,
  );

  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of privateValues) expect(sent).not.toContain(value);
  expect(result.content.experience.map((e) => e.id)[0]).toBe("a1b2c3d4");
  expect(new Set(result.content.experience.map((e) => e.id)).size).toBe(3);
  expect(result.content.experience[2].id).not.toBe("made-up");
  expect(result.content.projects[0].link).toBe("github.com/alexmoreno");
  expect(result.missingKeywords).toEqual(["PagerDuty"]);
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
    missingKeywords: [],
  });

  await tailorCv(
    cv.content,
    "Contact sam.rivera@example.org about this role. ".repeat(5),
    { language: "", pages: 1 },
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
