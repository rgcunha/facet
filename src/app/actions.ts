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
import { structureCv } from "@/lib/llm/structure";
import { extractLines } from "@/lib/pdf/extract";
import { detectPrivate } from "@/lib/privacy/detect";
import { createCv, deleteCv, updateCv } from "@/lib/store/cvs";
import {
  createImport,
  deleteImport,
  discardAllImports,
  discardImport,
  getImport,
} from "@/lib/store/imports";
import { recordImport, updateProfile } from "@/lib/store/profile";

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
    const content = await structureCv(draft.text, privateValues);
    await recordImport(privateValues);
    const cv = await createCv(
      content.headline || draft.fileName.replace(/\.pdf$/i, ""),
      {
        content,
        sourcePdf: draft.id,
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
