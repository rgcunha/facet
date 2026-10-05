import { describe, expect, test } from "bun:test";
import { emptyContent } from "@/lib/cv/empty";
import type { Contact, CvContent, MatchReport } from "@/lib/cv/schema";
import { parseDate } from "./dates";
import { readabilityChecks } from "./parsability";
import { scoreCv } from "./score";

const contact: Contact = {
  name: "Alex Moreno",
  email: "alex@example.com",
  phone: "",
  location: "",
  dateOfBirth: "",
  links: [],
};
const role = (r: string, company: string, start: string, end: string) => ({
  id: crypto.randomUUID(),
  role: r,
  company,
  location: "",
  start,
  end,
  highlights: [],
});
const content = (patch: Partial<CvContent>): CvContent => ({
  ...emptyContent(),
  ...patch,
});
type Job = Pick<MatchReport, "requirements" | "title" | "yearsRequired">;
const job = (patch: Partial<Job> = {}): Job => ({
  title: "Senior Platform Engineer",
  yearsRequired: null,
  requirements: [],
  ...patch,
});

describe("parseDate", () => {
  const now = new Date(2026, 9, 6);
  test("reads the formats CVs use", () => {
    expect(parseDate("03/2019")).toEqual({
      months: 2019 * 12 + 2,
      hasMonth: true,
    });
    expect(parseDate("Jan 2025")).toEqual({
      months: 2025 * 12,
      hasMonth: true,
    });
    expect(parseDate("Okt. 2016")).toEqual({
      months: 2016 * 12 + 9,
      hasMonth: true,
    });
    expect(parseDate("2021")).toEqual({ months: 2021 * 12, hasMonth: false });
    expect(parseDate("Present", now)?.months).toBe(2026 * 12 + 9);
    expect(parseDate("heute", now)?.months).toBe(2026 * 12 + 9);
    expect(parseDate("Atualmente", now)?.months).toBe(2026 * 12 + 9);
    expect(parseDate("Actualidad", now)?.months).toBe(2026 * 12 + 9);
    expect(parseDate("bis jetzt", now)?.months).toBe(2026 * 12 + 9);
    expect(parseDate("2019-03")).toEqual({
      months: 2019 * 12 + 2,
      hasMonth: true,
    });
    expect(parseDate("2019/11")).toEqual({
      months: 2019 * 12 + 10,
      hasMonth: true,
    });
    expect(parseDate("")).toBeNull();
    expect(parseDate("someday")).toBeNull();
  });
});

describe("scoreCv", () => {
  test("finds requirements or synonyms as whole words, ignoring case and punctuation", () => {
    const cv = content({
      summary: "Runs k8s clusters; writes Node.js and CI/CD pipelines.",
      skills: [{ id: "s", group: "", items: ["GoLang"] }],
    });
    const score = scoreCv(
      { contact, template: "classic", content: cv },
      job({
        requirements: [
          { name: "Kubernetes", synonyms: ["k8s"], priority: "must" },
          { name: "node.js", synonyms: [], priority: "must" },
          { name: "CI/CD", synonyms: [], priority: "nice" },
          { name: "Go", synonyms: [], priority: "must" }, // "GoLang" is not the word "Go"
        ],
      }),
    );
    expect(score.found).toEqual(["Kubernetes", "node.js", "CI/CD"]);
    expect(score.must).toEqual({ hit: 2, of: 3 });
    expect(score.nice).toEqual({ hit: 1, of: 1 });
  });

  test("title: all core words is a match, half is partial; seniority words don't count", () => {
    const title = (headline: string) =>
      scoreCv(
        { contact, template: "classic", content: content({ headline }) },
        job(),
      ).title;
    expect(title("Platform Engineer")).toBe("match");
    expect(title("Senior Backend Engineer")).toBe("partial");
    expect(title("Data Scientist")).toBe("none");
  });

  test("years of experience count overlapping roles once", () => {
    const cv = content({
      experience: [
        role("Engineer", "A", "01/2018", "12/2020"),
        role("Freelancer", "B", "06/2019", "05/2021"), // overlaps A until 12/2020
        role("Intern", "C", "2015", "2015"),
      ],
    });
    expect(
      scoreCv({ contact, template: "classic", content: cv }, job()).years.have,
    ).toBe(4); // 36 + 5 (B after A ends) + 12 months
  });

  test("total weighs the parts that apply, out of 100", () => {
    const cv = content({
      headline: "Platform Engineer",
      skills: [{ id: "s", group: "", items: ["Kubernetes"] }],
      experience: [role("Platform Engineer", "A", "2016", "2021")],
    });
    const full = scoreCv(
      { contact, template: "classic", content: cv },
      job({
        yearsRequired: 5,
        requirements: [{ name: "Kubernetes", synonyms: [], priority: "must" }],
      }),
    );
    expect(full.total).toBe(100);
    const half = scoreCv(
      { contact, template: "classic", content: cv },
      job({
        requirements: [
          { name: "Kubernetes", synonyms: [], priority: "must" },
          { name: "Terraform", synonyms: [], priority: "must" },
        ],
      }),
    );
    // must 50 × ½ + title 20 + readability 10, out of 80 (no nice-to-haves, no years asked)
    expect(half.total).toBe(Math.round((100 * 55) / 80));
  });
});

describe("readabilityChecks", () => {
  test("fails a role without a company or a readable start date, and missing contact", () => {
    const checks = readabilityChecks({
      template: "sidebar",
      contact: { ...contact, email: "" },
      content: content({ experience: [role("Engineer", "", "sometime", "")] }),
    });
    expect(checks.filter((c) => !c.pass).map((c) => c.label)).toEqual([
      "Name and an email or phone",
      "Every role has a job title and a company",
      "Every role has a start date an ATS can read",
      "One-column template",
      "Skills are listed",
    ]);
  });
});
