import { readFile, rm } from "node:fs/promises";
import { dataPath, isNotFound, isSafeId, writeFileAtomic } from "./fs";

/** Original PDFs of imported CVs, shown in the editor's "Original PDF" tab. */
const pdfFile = (id: string) => dataPath("sources", `${id}.pdf`);

export const saveSourcePdf = (id: string, pdf: Uint8Array) =>
  writeFileAtomic(pdfFile(id), pdf);

export async function getSourcePdf(id: string) {
  if (!isSafeId(id)) return null;
  try {
    return await readFile(pdfFile(id));
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function deleteSourcePdf(id: string) {
  if (isSafeId(id)) await rm(pdfFile(id), { force: true });
}
