"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { UNTITLED_CV } from "@/lib/cv/empty";
import { editorValuesSchema, profileSchema } from "@/lib/cv/schema";
import { createCv, deleteCv, updateCv } from "@/lib/store/cvs";
import { saveProfile } from "@/lib/store/profile";

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
  await saveProfile({
    v: 1,
    contact: profileSchema.shape.contact.parse(input),
  });
}
