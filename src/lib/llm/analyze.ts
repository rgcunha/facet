import type { LanguageModel } from "ai";
import {
  analysisSchema,
  type CvContent,
  type PrivateValue,
} from "@/lib/cv/schema";
import { PLACEHOLDER_RULE } from "./content";
import { generateStructured } from "./generate";

const SYSTEM = `You compare a CV with one job posting, the way a careful recruiter and an applicant tracking system would.

- requirements: the skills, tools, practices and qualifications the posting asks for, one per entry. They are matched word for word against the CV, so:
  - name: the skill itself in 1–3 words, without qualifiers such as "experience", "production", "strong" or "years of" ("Kubernetes", not "production Kubernetes experience"; "on-call", not "on-call experience").
  - synonyms: other ways a CV may write it ("k8s" for Kubernetes, "Postgres" for PostgreSQL). When any one of several skills is enough ("Go or Python"), name the first and put the others in synonyms.
  - priority: "must" when the posting requires it, "nice" when it is a plus.
  - Years of experience go in yearsRequired, not in requirements.
- strengths: up to 5 short points where the CV clearly meets the posting, citing what in the CV shows it.
- gaps: requirements the CV doesn't state but makes likely (e.g. Helm for someone running Kubernetes deployments). why: one sentence naming what in the CV suggests it. Only real hints; never guess.
- missing: requirements the CV gives no sign of. A requirement is in at most one of strengths, gaps and missing.
- suggestions: up to 4 concrete edits to the CV's wording or order that would match the posting better, without claiming anything new.
- Write in the language of the posting.
${PLACEHOLDER_RULE}`;

/** Compares a CV with a job posting. Every private value of the CV is masked before sending. */
export async function analyzeCv(
  content: CvContent,
  jobText: string,
  privateValues: PrivateValue[],
  model?: LanguageModel,
) {
  return generateStructured({
    schema: analysisSchema,
    system: SYSTEM,
    prompt: `Job posting:\n\n${jobText}\n\nCV (JSON):\n\n${JSON.stringify(content)}`,
    privateValues,
    model,
  });
}
