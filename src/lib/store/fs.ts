import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

/** Read at call time so tests (and users) can point DATA_DIR elsewhere. */
export function dataPath(...segments: string[]) {
  return path.join(
    process.env.DATA_DIR ?? path.join(process.cwd(), "data"),
    ...segments,
  );
}

const isNotFound = (e: unknown) =>
  (e as NodeJS.ErrnoException).code === "ENOENT";

/** Returns null when the file does not exist; throws when it exists but is invalid. */
export async function readJson<T>(
  file: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
  return schema.parse(JSON.parse(raw));
}

/** Write to a unique temp file, then rename over the target, so a crash never leaves a half-written file. */
export async function writeJsonAtomic(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await rename(tmp, file);
}

export async function listJsonFiles(dir: string) {
  try {
    return (await readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(dir, f));
  } catch (e) {
    if (isNotFound(e)) return [];
    throw e;
  }
}
