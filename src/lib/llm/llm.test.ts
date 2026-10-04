import { expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import type { PrivateValue } from "@/lib/cv/schema";
import { structureCv } from "./structure";

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

  const content = await structureCv(cvText, privateValues, model);

  const sent = JSON.stringify(model.doGenerateCalls);
  for (const { value } of privateValues) expect(sent).not.toContain(value);
  expect(sent).toContain("{{NAME}}");
  expect(content.projects[0].link).toBe("github.com/alexmoreno");
  expect(content.summary).toBe("Backend engineer. Alex Moreno likes Go.");
  expect(content.experience[0].id).toMatch(/^[0-9a-f]{8}$/);
});

test("a value the detector missed is still blocked if it is in the vault", async () => {
  const model = recordingModel({});
  // The text contains a phone number written differently from the vault entry: still masked/blocked.
  await expect(
    structureCv(
      "Call 00351-912-000-000",
      [{ kind: "phone", value: "+351 912 000 000" }],
      model,
    ),
  ).rejects.toThrow(/phone/);
  expect(model.doGenerateCalls).toHaveLength(0);
});
