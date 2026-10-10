import { rm } from "node:fs/promises";
import { emptyContent, shortId } from "@/lib/cv/empty";
import { fold } from "@/lib/cv/format";
import { type CvRecord, cvRecordSchema, type Todo } from "@/lib/cv/schema";
import { sameTodo } from "@/lib/cv/todos";
import {
  dataPath,
  isSafeId,
  listJsonFiles,
  readJson,
  writeJsonAtomic,
} from "./fs";
import { deleteSourcePdf } from "./sources";

const cvFile = (id: string) => dataPath("cvs", `${id}.json`);

const slug = (title: string) =>
  fold(title)
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
  return isSafeId(id) ? readJson(cvFile(id), cvRecordSchema) : null;
}

/** The base CV a variant was tailored from: the CV itself for a base, null if the base is gone. */
export async function getBase(cv: CvRecord) {
  return cv.baseId ? getCv(cv.baseId) : cv;
}

async function saveCv(cv: CvRecord) {
  const valid = cvRecordSchema.parse(cv);
  await writeJsonAtomic(cvFile(valid.id), valid);
}

type CvPatch = Partial<Omit<CvRecord, "v" | "id" | "createdAt" | "updatedAt">>;

/**
 * Writes to one CV run one at a time, so a read-change-write (an autosave, to-dos saved after a
 * review) never overwrites another that started meanwhile. One server process serves the app.
 */
const queues = new Map<string, Promise<unknown>>();
function oneAtATime<T>(id: string, write: () => Promise<T>) {
  const next = (queues.get(id) ?? Promise.resolve()).then(write, write);
  queues.set(
    id,
    next.catch(() => {}),
  ); // a failed write mustn't block the next one
  return next;
}

/** Changes the stored CV with what `change` returns for it. Throws if the CV doesn't exist. */
function patchCv(id: string, change: (cv: CvRecord) => Partial<CvRecord>) {
  return oneAtATime(id, async () => {
    const cv = await getCv(id);
    if (!cv) throw new Error(`CV "${id}" not found`);
    await saveCv({ ...cv, ...change(cv) });
  });
}

/** Merges `patch` into the stored CV and stamps `updatedAt`. */
export const updateCv = (id: string, patch: CvPatch) =>
  patchCv(id, () => ({ ...patch, updatedAt: new Date().toISOString() }));

/** To-dos aren't content: saving them keeps `updatedAt`, which stands for content changes (`reviseAction` checks it). */
export const saveTodos = (id: string, todos: Todo[]) =>
  patchCv(id, () => ({ todos }));

/** Marks one to-do done. Removing it by value, not by position, lets quick clicks land in any order. */
export const removeTodo = (id: string, todo: Todo) =>
  patchCv(id, (cv) => ({ todos: cv.todos.filter((t) => !sameTodo(t, todo)) }));

/** Short readable ids ("untitled-cv-3f9a") that never reuse the id of an existing CV. */
async function newId(title: string) {
  for (;;) {
    const id = [slug(title), shortId().slice(0, 4)].filter(Boolean).join("-");
    if (!(await getCv(id))) return id;
  }
}

type CvInit = Partial<
  Pick<
    CvRecord,
    | "kind"
    | "baseId"
    | "sourcePdf"
    | "language"
    | "pages"
    | "template"
    | "contact"
    | "vault"
    | "content"
    | "job"
    | "changes"
    | "lastRun"
  >
>;

export async function createCv(
  title: string,
  init: CvInit = {},
): Promise<CvRecord> {
  const now = new Date().toISOString();
  const cv = cvRecordSchema.parse({
    v: 1,
    id: await newId(title),
    title,
    kind: "base",
    baseId: null,
    language: "en",
    pages: 1,
    content: emptyContent(),
    ...init,
    createdAt: now,
    updatedAt: now,
  });
  await saveCv(cv);
  return cv;
}

/** Deleting a base CV also deletes its tailored variants. */
export async function deleteCv(id: string) {
  if (!isSafeId(id)) return;
  const cv = await getCv(id).catch(() => null); // a corrupt file can still be deleted
  await rm(cvFile(id), { force: true });
  if (cv?.sourcePdf) await deleteSourcePdf(cv.sourcePdf);
  if (cv?.kind === "base") {
    const variants = (await listCvs()).filter((v) => v.baseId === id);
    await Promise.all(variants.map((v) => deleteCv(v.id)));
  }
}
