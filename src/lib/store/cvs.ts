import { rm } from "node:fs/promises";
import { emptyContent, shortId } from "@/lib/cv/empty";
import { type CvRecord, cvIdSchema, cvRecordSchema } from "@/lib/cv/schema";
import { dataPath, listJsonFiles, readJson, writeJsonAtomic } from "./fs";

const cvFile = (id: string) => dataPath("cvs", `${id}.json`);

/** Rejects anything that is not a plain id, so a URL can never point outside the data folder. */
const isValidId = (id: string) => cvIdSchema.safeParse(id).success;

const slug = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export async function listCvs(): Promise<CvRecord[]> {
  const files = await listJsonFiles(dataPath("cvs"));
  const cvs = await Promise.all(files.map((f) => readJson(f, cvRecordSchema)));
  return cvs
    .filter((cv): cv is CvRecord => cv !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCv(id: string) {
  return isValidId(id) ? readJson(cvFile(id), cvRecordSchema) : null;
}

async function saveCv(cv: CvRecord) {
  const valid = cvRecordSchema.parse(cv);
  await writeJsonAtomic(cvFile(valid.id), valid);
}

type CvPatch = Partial<Omit<CvRecord, "v" | "id" | "createdAt" | "updatedAt">>;

/** Merges `patch` into the stored CV and stamps `updatedAt`. Throws if the CV doesn't exist. */
export async function updateCv(id: string, patch: CvPatch) {
  const cv = await getCv(id);
  if (!cv) throw new Error(`CV "${id}" not found`);
  await saveCv({ ...cv, ...patch, updatedAt: new Date().toISOString() });
}

/** Short readable ids ("untitled-cv-3f9a") that never reuse the id of an existing CV. */
async function newId(title: string) {
  for (;;) {
    const id = [slug(title), shortId().slice(0, 4)].filter(Boolean).join("-");
    if (!(await getCv(id))) return id;
  }
}

export async function createCv(title: string): Promise<CvRecord> {
  const now = new Date().toISOString();
  const cv: CvRecord = {
    v: 1,
    id: await newId(title),
    kind: "base",
    title,
    baseId: null,
    language: "en",
    pages: 1,
    content: emptyContent(),
    createdAt: now,
    updatedAt: now,
  };
  await saveCv(cv);
  return cv;
}

export async function deleteCv(id: string) {
  if (isValidId(id)) await rm(cvFile(id), { force: true });
}
