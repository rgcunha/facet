import { describe, expect, test } from "bun:test";
import type { PrivateValue } from "@/lib/cv/schema";
import type { TextLine } from "@/lib/pdf/extract";
import { emptyContent } from "@/lib/cv/empty";
import { detectInText, detectPrivate } from "./detect";
import { assertNoPrivateData } from "./guard";
import { redact, rehydrate, toMasks } from "./redact";

const lines = (...rows: [string, number?][]): TextLine[] =>
  rows.map(([text, size = 10]) => ({ text, size }));
const kinds = (found: PrivateValue[]) =>
  Object.fromEntries(found.map((f) => [f.value, f.kind]));

describe("detectPrivate", () => {
  test("English header on separate lines", () => {
    const found = detectPrivate(
      lines(
        ["Alex Moreno", 22],
        ["Senior Backend Engineer", 12],
        ["alex.moreno@example.com · +351 912 000 000"],
        ["linkedin.com/in/alex-moreno · https://github.com/alexmoreno"],
        ["Rua do Exemplo 12, 1000-001 Lisboa"],
        ["Date of birth: 14 March 1990"],
        ["EXPERIENCE"],
        ["Lead Backend Engineer, Orbital Pay · 2021 – 2024"],
      ),
    );
    expect(kinds(found)).toEqual({
      "Alex Moreno": "name",
      "alex.moreno@example.com": "email",
      "linkedin.com/in/alex-moreno": "url",
      "https://github.com/alexmoreno": "url",
      "+351 912 000 000": "phone",
      "Rua do Exemplo 12, 1000-001 Lisboa": "address",
      "14 March 1990": "dob",
    });
  });

  test("German header with everything on one line", () => {
    const found = detectPrivate(
      lines(
        ["Lebenslauf", 12],
        ["Jana Müller-Lüdenscheidt", 20],
        ["Hauptstraße 5 | 10115 Berlin | 0176 1234 5678 | jana@mueller.de"],
        ["Geburtsdatum: 03.11.1988"],
      ),
    );
    expect(kinds(found)).toEqual({
      "Jana Müller-Lüdenscheidt": "name",
      "jana@mueller.de": "email",
      "0176 1234 5678": "phone",
      "Hauptstraße 5": "address",
      "10115 Berlin": "address",
      "03.11.1988": "dob",
    });
  });

  test("finds a date of birth with no label, or whose label is on the line before", () => {
    const year = new Date().getFullYear() - 35;
    const found = detectPrivate(
      lines(
        ["Ana Silva", 20],
        [`12.03.${year} · Lisbon`],
        ["Geburtsdatum"],
        [`1 March ${year - 1}`],
        ["EXPERIENCE"],
      ),
    );
    expect(Object.values(kinds(found)).filter((k) => k === "dob")).toHaveLength(
      2,
    );
    expect(kinds(found)).toMatchObject({
      [`12.03.${year}`]: "dob",
      [`1 March ${year - 1}`]: "dob",
    });
  });

  test("does not mistake a recent full date in the header for a date of birth", () => {
    const recent = new Date().getFullYear() - 2;
    const found = detectPrivate(
      lines(["Ana Silva", 20], [`Available from 01.09.${recent}`]),
    );
    expect(kinds(found)).toEqual({ "Ana Silva": "name" });
  });

  test("does not mistake years, date ranges or skills for personal data", () => {
    const found = detectPrivate(
      lines(
        ["Ana Silva", 20],
        ["2017 - 2021 · 2015/2017 · 03/2019 - 05/2021 · 03.2019–05.2021"],
        ["Skills: Node.js, ASP.NET, Go"],
        ["Managed a budget of 2,500,000 EUR"],
      ),
    );
    expect(kinds(found)).toEqual({ "Ana Silva": "name" });
  });
});

describe("redact / rehydrate", () => {
  const masks = toMasks([
    { kind: "name", value: "Alex Moreno" },
    { kind: "url", value: "linkedin.com/in/alex-moreno" },
    { kind: "url", value: "github.com/alexmoreno" },
  ]);

  test("tokens are stable and numbered per kind", () => {
    expect(masks.map((m) => m.token)).toEqual([
      "{{NAME}}",
      "{{URL}}",
      "{{URL_2}}",
    ]);
  });

  test("replaces every occurrence, any case and any whitespace", () => {
    expect(
      redact("ALEX\n  MORENO — github.com/alexmoreno, alex moreno", masks),
    ).toBe("{{NAME}} — {{URL_2}}, {{NAME}}");
  });

  test("masks phone numbers whatever their separators", () => {
    const phone = toMasks([{ kind: "phone", value: "+351 912 345 678" }]);
    expect(
      redact(
        "call +351 912-345-678 or 00351912345678 or (351) 912.345.678",
        phone,
      ),
    ).toBe("call +{{PHONE}} or 00{{PHONE}} or ({{PHONE}}");
  });

  test("rehydrate restores tokens in nested data", () => {
    const back = rehydrate(
      { projects: [{ link: "{{URL_2}}", tags: ["by {{NAME}}"] }], n: 3 },
      masks,
    );
    expect(back).toEqual({
      projects: [{ link: "github.com/alexmoreno", tags: ["by Alex Moreno"] }],
      n: 3,
    });
  });
});

describe("assertNoPrivateData", () => {
  const values: PrivateValue[] = [
    { kind: "email", value: "alex@example.com" },
    { kind: "phone", value: "+351 912 000 000" },
  ];

  test("passes clean payloads", () => {
    expect(() =>
      assertNoPrivateData("Contact: {{EMAIL}} {{PHONE}}", values),
    ).not.toThrow();
  });

  test("blocks values, whatever their case or formatting, and never echoes them", () => {
    expect(() => assertNoPrivateData("mail ALEX@EXAMPLE.COM", values)).toThrow(
      /email/,
    );
    expect(() => assertNoPrivateData("call 351-912-000-000", values)).toThrow(
      /phone/,
    );
    try {
      assertNoPrivateData("alex@example.com", values);
    } catch (e) {
      expect(String(e)).not.toContain("alex@example.com");
    }
  });
});

test("emphasis markers inside a multi-word value don't hide it from masking or the guard", () => {
  const values: PrivateValue[] = [{ kind: "custom", value: "Acme Corp" }];
  const text = "Shipped billing for **Acme** Corp and *Acme Corp*.";
  const masked = redact(text, toMasks(values));
  expect(masked).not.toMatch(/acme|corp/i);
  expect(() => assertNoPrivateData(masked, values)).not.toThrow();
  expect(() => assertNoPrivateData(text, values)).toThrow(/custom/);
});

describe("detectInText", () => {
  const content = {
    ...emptyContent(),
    experience: [
      {
        id: "a",
        role: "Lead Engineer",
        company: "Orbital Pay",
        location: "",
        start: "",
        end: "",
        highlights: [],
      },
    ],
  };

  test("flags a person's name the CV doesn't contain, but not the CV's own employers", () => {
    const found = detectInText(
      "Make the Orbital Pay role read more senior. Mention Marta Silva’s risk team.",
      content,
    );
    expect(found).toEqual([{ kind: "name", value: "Marta Silva" }]);
  });

  test("flags emails, links and phone numbers", () => {
    const found = detectInText(
      "Add my portfolio github.com/someone, write to ana@example.com or +351 912 000 000.",
      content,
    );
    expect(kinds(found)).toEqual({
      "ana@example.com": "email",
      "github.com/someone": "url",
      "+351 912 000 000": "phone",
    });
  });

  test("a name opening the instruction or with inner capitals is caught whole", () => {
    expect(
      detectInText("Marta Silva reviewed my design doc.", content),
    ).toEqual([{ kind: "name", value: "Marta Silva" }]);
    expect(detectInText("Mentor: Marta Silva", content)).toEqual([
      { kind: "name", value: "Marta Silva" },
    ]);
    expect(detectInText("Thank John O'Neil-Smith", content)).toEqual([
      { kind: "name", value: "John O'Neil-Smith" },
    ]);
  });

  test("a name is only excused by the same whole words in the CV", () => {
    const cv = {
      ...content,
      projects: [
        { id: "p", name: "Joana Silva Consulting", link: "", description: "" },
      ],
    };
    expect(detectInText("Thank Ana Silva for the intro.", cv)).toEqual([
      { kind: "name", value: "Ana Silva" },
    ]);
  });

  test("plain instructions flag nothing", () => {
    expect(
      detectInText("Shorten the summary. Use present tense.", content),
    ).toEqual([]);
  });
});
