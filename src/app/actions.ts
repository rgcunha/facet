"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UNTITLED_CV } from "@/lib/cv/empty";
import {
  editorValuesSchema,
  privateValueSchema,
  profileSchema,
} from "@/lib/cv/schema";
import { NO_CHANGES, recordChanges } from "@/lib/cv/changes";
import { fetchJobText } from "@/lib/job/fetch";
import { structureCv } from "@/lib/llm/structure";
import { tailorCv } from "@/lib/llm/tailor";
import { tightenCv } from "@/lib/llm/tighten";
import { extractLines } from "@/lib/pdf/extract";
import { detectPrivate } from "@/lib/privacy/detect";
import { createCv, deleteCv, getBase, getCv, updateCv } from "@/lib/store/cvs";
import {
  createImport,
  deleteImport,
  discardAllImports,
  discardImport,
  getImport,
} from "@/lib/store/imports";
import { getProfile, recordImport, updateProfile } from "@/lib/store/profile";

type ActionResult = { error: string } | undefined;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

export async function createCvAction() {
  const cv = await createCv(UNTITLED_CV);
  redirect(`/cv/${cv.id}`);
}

export async function deleteCvAction(id: string) {
  await deleteCv(id);
  refresh();
}

const cvFieldsSchema = editorValuesSchema.omit({ contact: true });

/** Autosave of one CV's own fields. */
export async function saveCvAction(id: string, input: unknown) {
  await updateCv(id, cvFieldsSchema.parse(input));
}

/**
 * Autosave of the contact details shared by all CVs. The editor only calls this when contact fields
 * were edited, so an editor open on another CV can't overwrite them with what it loaded earlier.
 */
export async function saveContactAction(input: unknown) {
  await updateProfile({ contact: profileSchema.shape.contact.parse(input) });
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
): Promise<ActionResult> {
  const draft = await getImport(importId);
  if (!draft)
    return { error: "This import no longer exists. Upload the PDF again." };
  const privateValues = z.array(privateValueSchema).parse(masked);

  let cvId: string;
  try {
    const { content, language } = await structureCv(draft.text, privateValues);
    await recordImport(privateValues);
    const cv = await createCv(
      content.headline || draft.fileName.replace(/\.pdf$/i, ""),
      { content, language, sourcePdf: draft.id },
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

const tailorInputSchema = z.object({
  jobText: z
    .string()
    .trim()
    .min(
      200,
      "Paste the whole job description (a few paragraphs), not just the title.",
    ),
  url: z.string().trim(),
  language: z.string(),
  pages: z.union([z.literal(1), z.literal(2)]),
});

/**
 * Creates a variant of a CV tailored to a job posting and opens it. Only the CV content and the
 * job text are sent, masked with the vault; changes and possible fabrications are recorded locally.
 */
export async function tailorAction(
  cvId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = tailorInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { jobText, url, language, pages } = parsed.data;
  const cv = await getCv(cvId);
  if (!cv) return { error: "This CV no longer exists." };

  let variantId: string;
  try {
    // Changes and possible fabrications are judged against the base CV, even when tailoring a variant further.
    const [found, { vault }] = await Promise.all([getBase(cv), getProfile()]);
    const base = found ?? cv; // the base was deleted: judge against this CV
    const tailored = await tailorCv(
      cv.content,
      jobText,
      { language, pages },
      vault,
    );
    const variantLanguage = language || tailored.job.language;
    const variant = await createCv(tailored.job.title || cv.title, {
      kind: "variant",
      baseId: found?.id ?? cv.baseId,
      language: variantLanguage,
      pages,
      content: tailored.content,
      job: {
        ...tailored.job,
        url,
        text: jobText,
        missingKeywords: tailored.missingKeywords,
      },
      changes: recordChanges(
        NO_CHANGES,
        cv.content,
        tailored.content,
        base.content,
        {
          translated: variantLanguage !== base.language,
        },
      ),
    });
    variantId = variant.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect(`/cv/${variantId}`);
}

/** Shortens a CV in place by about `overflowLines` lines; every edit can be reverted like a tailoring change. */
export async function tightenAction(
  cvId: string,
  overflowLines: number,
): Promise<ActionResult> {
  const cv = await getCv(cvId);
  if (!cv) return { error: "This CV no longer exists." };
  try {
    const [found, { vault }] = await Promise.all([getBase(cv), getProfile()]);
    const base = found ?? cv; // the base was deleted: judge against this CV
    const content = await tightenCv(
      cv.content,
      Math.max(1, Math.round(overflowLines)),
      vault,
    );
    // The editor is locked while tightening; still, never overwrite a save made during the call.
    if ((await getCv(cvId))?.updatedAt !== cv.updatedAt)
      return {
        error:
          "The CV changed while it was being shortened. Nothing was overwritten; try again.",
      };
    await updateCv(cvId, {
      content,
      changes: recordChanges(cv.changes, cv.content, content, base.content, {
        translated: cv.language !== base.language,
      }),
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refresh(); // the editor reloads with the shortened content (it remounts on a new updatedAt)
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
