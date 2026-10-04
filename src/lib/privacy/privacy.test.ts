import { describe, expect, test } from "bun:test";
import type { PrivateValue } from "@/lib/cv/schema";
import type { TextLine } from "@/lib/pdf/extract";
import { detectPrivate } from "./detect";
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
