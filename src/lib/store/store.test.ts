import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_CHECKLIST } from "@/lib/cv/checklist";
import { getChecklist, saveChecklist } from "./checklist";
import {
  createCv,
  deleteCv,
  getCv,
  listCvs,
  removeTodo,
  saveTodos,
  updateCv,
} from "./cvs";
import { createImport, discardAllImports, getImport } from "./imports";
import { getSourcePdf } from "./sources";

const root = await mkdtemp(path.join(tmpdir(), "cv-tool-"));
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(root, "data-"));
  process.env.DATA_DIR = dir;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("checklist", () => {
  test("the default until the user saves their own, which then reads back", async () => {
    expect(await getChecklist()).toEqual(DEFAULT_CHECKLIST);
    const rules = [{ name: "Tense", text: "Past tense throughout." }];
    await saveChecklist(rules);
    expect(await getChecklist()).toEqual(rules);
  });

  test("rejects an empty list and duplicate names", async () => {
    await expect(saveChecklist([])).rejects.toThrow(/at least one rule/);
    await expect(
      saveChecklist([
        { name: "Tense", text: "One" },
        { name: "Tense", text: "Two" },
      ]),
    ).rejects.toThrow(/different name/);
  });
});

describe("cvs", () => {
  test("Done removes that to-do, whatever order quick clicks arrive in", async () => {
    const cv = await createCv("Base");
    const [a, b, c] = ["One", "Two", "Three"].map((problem) => ({
      area: "summary" as const,
      entryId: null,
      problem,
      detail: "",
      rule: "Impact",
    }));
    await saveTodos(cv.id, [a, b, c]);
    await Promise.all([removeTodo(cv.id, b), removeTodo(cv.id, a)]);
    expect((await getCv(cv.id))?.todos).toEqual([c]);
  });

  test("an autosave and a to-do save at the same time both land", async () => {
    const cv = await createCv("Base");
    const todo = {
      area: "summary" as const,
      entryId: null,
      problem: "Add a number",
      detail: "",
      rule: "Impact",
    };
    await Promise.all([
      updateCv(cv.id, { content: { ...cv.content, headline: "Engineer" } }),
      saveTodos(cv.id, [todo]),
    ]);
    const saved = await getCv(cv.id);
    expect(saved?.content.headline).toBe("Engineer");
    expect(saved?.todos).toEqual([todo]);
  });

  test("saving to-dos keeps updatedAt, so an open editor doesn't reload", async () => {
    const cv = await createCv("Base");
    const todo = {
      area: "summary" as const,
      entryId: null,
      problem: "Add a number",
      detail: "How much faster?",
      rule: "Impact",
    };
    await saveTodos(cv.id, [todo]);
    const saved = await getCv(cv.id);
    expect(saved?.todos).toEqual([todo]);
    expect(saved?.updatedAt).toBe(cv.updatedAt);
  });

  test("create → get round trip", async () => {
    const cv = await createCv("Résumé: Senior Backend Engineer");
    expect(cv.id).toMatch(/^resume-senior-backend-engineer-[a-z0-9]{4}$/);
    expect(await getCv(cv.id)).toEqual(cv);
  });

  test("update merges, stamps updatedAt and leaves no temp files behind", async () => {
    const cv = await createCv("Base");
    await Bun.sleep(5);
    await updateCv(cv.id, { content: { ...cv.content, headline: "Engineer" } });
    const updated = await getCv(cv.id);
    expect(updated?.content.headline).toBe("Engineer");
    expect(updated?.title).toBe("Base");
    expect(updated!.updatedAt > cv.updatedAt).toBe(true);
    expect(await readdir(path.join(dir, "cvs"))).toEqual([`${cv.id}.json`]);
  });

  test("list is empty without a data folder and newest first otherwise", async () => {
    expect(await listCvs()).toEqual([]);
    const older = await createCv("Older");
    const newer = await createCv("Newer");
    await Bun.sleep(5);
    await updateCv(older.id, { title: "Older, edited" });
    expect((await listCvs()).map((cv) => cv.id)).toEqual([older.id, newer.id]);
  });

  test("ids that could escape the data folder are rejected", async () => {
    expect(await getCv("../profile")).toBeNull();
    expect(await getCv("missing-id")).toBeNull();
  });

  test("an invalid file is reported, not silently ignored", async () => {
    const cv = await createCv("Broken");
    await writeFile(path.join(dir, "cvs", `${cv.id}.json`), '{"v":1}');
    await expect(getCv(cv.id)).rejects.toThrow();
  });

  test("missing fields in an older file are filled from schema defaults", async () => {
    const cv = await createCv("Old format");
    const oldFile: Record<string, unknown> = {
      ...cv,
      content: { ...cv.content },
    };
    delete (oldFile.content as Record<string, unknown>).headline;
    await writeFile(
      path.join(dir, "cvs", `${cv.id}.json`),
      JSON.stringify(oldFile),
    );
    expect((await getCv(cv.id))?.content.headline).toBe("");
  });

  test("updating a missing CV throws", async () => {
    await expect(updateCv("missing-id", { title: "x" })).rejects.toThrow();
  });

  test("delete removes the CV", async () => {
    const cv = await createCv("Gone");
    await deleteCv(cv.id);
    expect(await getCv(cv.id)).toBeNull();
  });
});

describe("imports", () => {
  test("discarding leftover imports removes their unmasked text and PDF", async () => {
    const id = await createImport(new Uint8Array([37, 80, 68, 70]), {
      fileName: "cv.pdf",
      pageCount: 1,
      text: "Alex Moreno",
      detected: [{ kind: "name", value: "Alex Moreno" }],
    });
    expect(await getImport(id)).not.toBeNull();
    expect(await getSourcePdf(id)).not.toBeNull();
    await discardAllImports();
    expect(await getImport(id)).toBeNull();
    expect(await getSourcePdf(id)).toBeNull();
    expect(await readdir(path.join(dir, "imports"))).toEqual([]);
  });
});
