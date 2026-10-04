import { rm } from "node:fs/promises";
import path from "node:path";
import { shortId } from "@/lib/cv/empty";
import { type ImportDraft, importDraftSchema } from "@/lib/cv/schema";
import {
  dataPath,
  isSafeId,
  listJsonFiles,
  readJson,
  writeJsonAtomic,
} from "./fs";
import { deleteSourcePdf, saveSourcePdf } from "./sources";

const draftFile = (id: string) => dataPath("imports", `${id}.json`);

/** Saves an uploaded PDF and its extracted text until the user parses it on the Import screen. */
export async function createImport(
  pdf: Uint8Array,
  draft: Omit<ImportDraft, "v" | "id">,
) {
  const id = `import-${shortId()}`;
  await saveSourcePdf(id, pdf);
  await writeJsonAtomic(
    draftFile(id),
    importDraftSchema.parse({ v: 1, id, ...draft }),
  );
  return id;
}

export async function getImport(id: string) {
  return isSafeId(id) ? readJson(draftFile(id), importDraftSchema) : null;
}

/** The draft's text is no longer needed once parsed; its PDF stays, owned by the new CV. */
export async function deleteImport(id: string) {
  if (isSafeId(id)) await rm(draftFile(id), { force: true });
}

/** An abandoned import: remove its draft text and its PDF (no CV owns it yet). */
export async function discardImport(id: string) {
  await deleteImport(id);
  await deleteSourcePdf(id);
}

/** Leftovers from imports that were never parsed or cancelled (e.g. the tab was closed). */
export async function discardAllImports() {
  const drafts = await listJsonFiles(dataPath("imports"));
  await Promise.all(
    drafts.map((f) => discardImport(path.basename(f, ".json"))),
  );
}
