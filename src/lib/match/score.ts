import { entryValues, filled, fold, visible } from "@/lib/cv/format";
import {
  type Analysis,
  type Contact,
  type CvContent,
  LIST_SECTIONS,
} from "@/lib/cv/schema";
import { parseDate } from "./dates";
import { readabilityChecks } from "./parsability";

/** How much each part counts, out of 100. Parts that don't apply (e.g. no years asked) are left out. */
const WEIGHTS = { must: 50, title: 20, nice: 15, readability: 10, years: 5 };
/** Words that say how senior a title is, not what the job is. */
const SENIORITY = new Set(
  "senior sr junior jr lead principal staff head chief mid level i ii iii m w f d x".split(
    " ",
  ),
);

/** Lower case, no accents, punctuation as spaces, padded: " node js ". Whole-word search is then `includes`. */
const words = (s: string) =>
  ` ${fold(s)
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim()} `;

const cvWords = (content: CvContent) =>
  words(
    [
      content.headline,
      content.summary,
      ...LIST_SECTIONS.flatMap((s) => content[s].flatMap(entryValues)),
    ].join(" "),
  );

const mentions = (text: string, term: string) =>
  term.trim() !== "" && text.includes(words(term));

/** Months of experience, with overlapping roles (e.g. freelance alongside a job) counted once. */
function monthsOfExperience(content: CvContent) {
  const spans = visible(content.experience)
    .flatMap((r) => {
      const start = parseDate(r.start);
      const end = parseDate(r.end) ?? start;
      if (!start || !end) return [];
      // "2019 – 2021" covers January 2019 to December 2021.
      return [[start.months, end.months + (end.hasMonth ? 1 : 12)]];
    })
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let reached = -Infinity;
  for (const [from, to] of spans) {
    total += Math.max(0, to - Math.max(from, reached));
    reached = Math.max(reached, to);
  }
  return total;
}

function titleMatch(
  content: CvContent,
  jobTitle: string,
): "match" | "partial" | "none" {
  const core = filled(words(jobTitle).split(" ")).filter(
    (w) => !SENIORITY.has(w),
  );
  const own = words(
    [content.headline, visible(content.experience)[0]?.role ?? ""].join(" "),
  );
  const found = core.filter((w) => own.includes(` ${w} `)).length;
  if (core.length === 0 || found === core.length) return "match";
  return found * 2 >= core.length ? "partial" : "none";
}

/**
 * A match score in the spirit of an ATS keyword match, computed locally so it can update as the
 * user edits: the job's requirements (or a synonym) found as whole words, title, years, readability.
 */
export function scoreCv(
  cv: { contact: Contact; content: CvContent },
  report: Pick<Analysis, "requirements" | "title" | "yearsRequired">,
) {
  const text = cvWords(cv.content);
  const found = report.requirements.filter((r) =>
    [r.name, ...r.synonyms].some((term) => mentions(text, term)),
  );
  const count = (priority: "must" | "nice") => ({
    hit: found.filter((r) => r.priority === priority).length,
    of: report.requirements.filter((r) => r.priority === priority).length,
  });
  const must = count("must");
  const nice = count("nice");
  const title = titleMatch(cv.content, report.title);
  const years = {
    have: Math.floor(monthsOfExperience(cv.content) / 12),
    asked: report.yearsRequired,
  };
  const readability = readabilityChecks(cv);
  const passed = readability.filter((c) => c.pass).length;

  const parts: [number, number | null][] = [
    [WEIGHTS.must, must.of ? must.hit / must.of : null],
    [WEIGHTS.title, title === "match" ? 1 : title === "partial" ? 0.5 : 0],
    [WEIGHTS.nice, nice.of ? nice.hit / nice.of : null],
    [WEIGHTS.readability, passed / readability.length],
    [WEIGHTS.years, years.asked ? Math.min(1, years.have / years.asked) : null],
  ];
  const counted = parts.filter((p): p is [number, number] => p[1] !== null);
  const total = Math.round(
    (100 * counted.reduce((sum, [w, f]) => sum + w * f, 0)) /
      counted.reduce((sum, [w]) => sum + w, 0),
  );
  return {
    total,
    must,
    nice,
    title,
    years,
    readability,
    found: found.map((r) => r.name),
  };
}

export type MatchScore = ReturnType<typeof scoreCv>;
