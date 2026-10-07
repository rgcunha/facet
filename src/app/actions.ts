"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UNTITLED_CV } from "@/lib/cv/empty";
import {
  type Analysis,
  analysisSchema,
  type CvRecord,
  editorValuesSchema,
  type PrivateValue,
  privateValueSchema,
  type Run,
  type Suggestion,
  suggestionSchema,
} from "@/lib/cv/schema";
import { NO_CHANGES, recordChanges } from "@/lib/cv/changes";
import { TEMPLATE_INFO } from "@/lib/cv/templates";
import { fetchJobText } from "@/lib/job/fetch";
import { scoreCv } from "@/lib/match/score";
import { analyzeCv } from "@/lib/llm/analyze";
import { structureCv } from "@/lib/llm/structure";
import { tailorCv } from "@/lib/llm/tailor";
import { reviewCv } from "@/lib/llm/review";
import {
  applyInstruction,
  reviseCv,
  tightenInstruction,
} from "@/lib/llm/revise";
import { extractLines } from "@/lib/pdf/extract";
import { detectPrivate } from "@/lib/privacy/detect";
import { contactFromValues, privateValuesOf } from "@/lib/privacy/values";
import { createCv, deleteCv, getBase, getCv, updateCv } from "@/lib/store/cvs";
import {
  createImport,
  deleteImport,
  discardAllImports,
  discardImport,
  getImport,
} from "@/lib/store/imports";

type ActionResult = { error: string } | undefined;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const errorMessage = (e: unknown) =>
  e instanceof z.ZodError
    ? e.issues[0].message
    : e instanceof Error
      ? e.message
      : String(e);

/** The model the user picked. `generateStructured` then checks that it is one of LLM_MODELS. */
const modelIdSchema = z.string("Pick a model.");

export async function createCvAction() {
  const cv = await createCv(UNTITLED_CV);
  redirect(`/cv/${cv.id}`);
}

export async function deleteCvAction(id: string) {
  await deleteCv(id);
  refresh();
}

/** Autosave of everything the editor form edits. */
export async function saveCvAction(id: string, input: unknown) {
  await updateCv(id, editorValuesSchema.parse(input));
}

/** Step 1 of import: read the PDF locally and find personal details. Nothing is sent anywhere. */
export async function uploadPdfAction(
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || !/\.pdf$/i.test(file.name))
    return { error: "Choose a PDF file." };
  if (file.size > MAX_PDF_BYTES)
    return { error: "That PDF is larger than 10 MB." };

  let id: string;
  try {
    await discardAllImports(); // anything left from an earlier import that was never parsed or cancelled
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { lines, pageCount } = await extractLines(bytes);
    id = await createImport(bytes, {
      fileName: file.name,
      pageCount,
      text: lines.map((l) => l.text).join("\n"),
      detected: detectPrivate(lines),
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/import/${id}`);
}

/** Step 2 of import: send the masked text to the model, then create the CV and open it. */
export async function parseImportAction(
  importId: string,
  masked: unknown,
  model: unknown,
): Promise<ActionResult> {
  const draft = await getImport(importId);
  if (!draft)
    return { error: "This import no longer exists. Upload the PDF again." };
  const privateValues = z.array(privateValueSchema).parse(masked);

  let cvId: string;
  try {
    const { content, language, run } = await structureCv(
      draft.text,
      privateValues,
      modelIdSchema.parse(model),
    );
    const cv = await createCv(
      content.headline || draft.fileName.replace(/\.pdf$/i, ""),
      {
        content,
        language,
        sourcePdf: draft.id,
        contact: contactFromValues(privateValues),
        vault: privateValues,
        lastRun: run,
      },
    );
    await deleteImport(draft.id);
    cvId = cv.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/cv/${cvId}?imported=1`);
}

/** Leaving the Import screen without parsing: the unmasked text and the PDF are deleted. */
export async function cancelImportAction(importId: string) {
  await discardImport(importId);
  redirect("/");
}

const jobTextSchema = z
  .string()
  .trim()
  .min(
    200,
    "Paste the whole job description (a few paragraphs), not just the title.",
  );

/** Compares a CV with a job posting. The report is returned, not saved: it is kept only on the variant it produces. */
export async function analyzeAction(
  cvId: string,
  jobText: unknown,
  model: unknown,
): Promise<{ report: Analysis; run: Run } | { error: string }> {
  const parsed = jobTextSchema.safeParse(jobText);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const cv = await getCv(cvId);
  if (!cv) return { error: "This CV no longer exists." };
  try {
    const { analysis, run } = await analyzeCv(
      cv.content,
      parsed.data,
      privateValuesOf(cv),
      modelIdSchema.parse(model),
    );
    return { report: analysis, run };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const tailorInputSchema = z.object({
  jobText: jobTextSchema,
  url: z.string().trim(),
  language: z.string(),
  pages: z.union([z.literal(1), z.literal(2)]),
  report: analysisSchema,
  confirmed: z.array(z.string()),
  model: modelIdSchema,
});

/**
 * Creates a variant of a CV tailored to a job posting from its match report, and opens it. Only the
 * CV content and the job text are sent, masked; changes and possible fabrications are recorded locally.
 */
export async function tailorAction(
  cvId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = tailorInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { jobText, url, language, pages, model } = parsed.data;
  // Input hygiene: confirmed names must be gaps of the report (both come from this user's own browser).
  const report = {
    ...parsed.data.report,
    confirmed: parsed.data.confirmed.filter((name) =>
      parsed.data.report.gaps.some((g) => g.name === name),
    ),
    createdAt: new Date().toISOString(),
  };
  const cv = await getCv(cvId);
  if (!cv) return { error: "This CV no longer exists." };

  let variantId: string;
  try {
    // Changes and possible fabrications are judged against the base CV, even when tailoring a variant further.
    const found = await getBase(cv);
    const base = found ?? cv; // the base was deleted: judge against this CV
    const tailored = await tailorCv(
      cv.content,
      jobText,
      { language, pages, report },
      privateValuesOf(cv),
      model,
    );
    const variantLanguage = language || tailored.job.language;
    const variant = await createCv(tailored.job.title || cv.title, {
      kind: "variant",
      baseId: found?.id ?? cv.baseId,
      language: variantLanguage,
      pages,
      template: cv.template,
      contact: cv.contact,
      vault: cv.vault,
      content: tailored.content,
      job: {
        ...tailored.job,
        url,
        text: jobText,
        report,
      },
      changes: recordChanges(
        NO_CHANGES,
        cv.content,
        tailored.content,
        base.content,
        {
          translated: variantLanguage !== base.language,
          knownSkills: report.confirmed,
        },
      ),
      lastRun: tailored.run,
    });
    variantId = variant.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/cv/${variantId}`);
}

/** The job requirements a variant matches, so reviewing or editing it doesn't lose them. */
const keepTerms = (cv: CvRecord) =>
  cv.job?.report ? scoreCv(cv, cv.job.report).found : [];

/** Reviews a CV against good CV practice. The suggestions are returned, not saved. */
export async function reviewAction(
  cvId: string,
  model: unknown,
): Promise<{ suggestions: Suggestion[]; run: Run } | { error: string }> {
  const cv = await getCv(cvId);
  if (!cv) return { error: "This CV no longer exists." };
  try {
    return await reviewCv(
      cv.content,
      privateValuesOf(cv),
      { keep: keepTerms(cv) },
      modelIdSchema.parse(model),
    );
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const reviseRequestSchema = z.union([
  z.object({ tighten: z.number().int().nonnegative() }),
  z.object({ suggestions: z.array(suggestionSchema).min(1) }),
  z.object({
    instruction: z
      .string()
      .trim()
      .min(3, "Write what should change.")
      .max(2000, "Keep the instruction under 2000 characters."),
  }),
]);

export type ReviseRequest = z.infer<typeof reviseRequestSchema>;

/**
 * Edits a CV in place with the model: "Tighten to fit" (shorten by about `tighten` lines), the fixes
 * ticked in a review, or the user's own instruction. `masks` are extra values to mask in this request
 * (names found in the instruction); they aren't saved. Every edit can be reverted like a tailoring change.
 */
export async function reviseAction(
  cvId: string,
  request: ReviseRequest,
  model: unknown,
  masks: PrivateValue[] = [],
): Promise<ActionResult> {
  const parsed = reviseRequestSchema.safeParse(request);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const extra = z.array(privateValueSchema).safeParse(masks);
  if (!extra.success) return { error: "Invalid masks." };
  const cv = await getCv(cvId);
  if (!cv) return { error: "This CV no longer exists." };
  const req = parsed.data;
  let instruction: string;
  if ("tighten" in req)
    instruction = tightenInstruction(
      req.tighten,
      TEMPLATE_INFO[cv.template].wordsPerLine,
    );
  else if ("suggestions" in req)
    instruction = applyInstruction(req.suggestions);
  else instruction = req.instruction;
  try {
    const base = (await getBase(cv)) ?? cv; // the base was deleted: judge against this CV
    const { content, run } = await reviseCv(
      cv.content,
      instruction,
      [...privateValuesOf(cv), ...extra.data],
      { keep: keepTerms(cv) },
      modelIdSchema.parse(model),
    );
    // The editor is locked during the call; still, never overwrite a save made meanwhile.
    if ((await getCv(cvId))?.updatedAt !== cv.updatedAt)
      return {
        error:
          "The CV changed while the model was editing it. Nothing was overwritten; try again.",
      };
    await updateCv(cvId, {
      content,
      changes: recordChanges(cv.changes, cv.content, content, base.content, {
        translated: cv.language !== base.language,
        knownSkills: cv.job?.report?.confirmed,
        // Facts and numbers the user typed come from them, not the model.
        stated: "instruction" in req ? req.instruction : "",
      }),
      lastRun: run,
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refresh(); // the editor reloads with the edited content (it remounts on a new updatedAt)
}

export async function fetchJobAction(
  url: string,
): Promise<{ text: string } | { error: string }> {
  try {
    return { text: await fetchJobText(url) };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
