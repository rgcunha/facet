import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const TIMEOUT_MS = 10_000;
/** Less text than this is a page that needs JavaScript or a login, not a job description. */
const MIN_TEXT_LENGTH = 300;
const PASTE_INSTEAD = "Paste the job description into the text box instead.";

/**
 * Best effort: many job sites (LinkedIn, Workday…) need JavaScript or a login and return
 * nothing useful to a plain request. Pasting the text is the main way in; this just saves a step.
 */
export async function fetchJobText(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("That isn't a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol))
    throw new Error("Only http(s) links can be fetched.");

  const response = await fetch(parsed, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (CV Tool; job description fetch)" },
  }).catch(() => null);
  if (!response?.ok)
    throw new Error(`Couldn't load that page. ${PASTE_INSTEAD}`);

  const { document } = parseHTML(await response.text());
  const article = new Readability(document as unknown as Document).parse();
  const text = (article?.textContent ?? "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < MIN_TEXT_LENGTH)
    throw new Error(
      `That page didn't contain a readable job description. ${PASTE_INSTEAD}`,
    );
  return [article?.title, text].filter(Boolean).join("\n\n");
}
