import { DEFAULT_CHECKLIST } from "@/lib/cv/checklist";
import { type ChecklistRule, checklistSchema } from "@/lib/cv/schema";
import { dataPath, readJson, writeJsonAtomic } from "./fs";

const file = () => dataPath("checklist.json");

/** The review checklist: the user's own, or the default until they edit it. */
export async function getChecklist() {
  return (await readJson(file(), checklistSchema))?.rules ?? DEFAULT_CHECKLIST;
}

export async function saveChecklist(rules: ChecklistRule[]) {
  await writeJsonAtomic(file(), checklistSchema.parse({ v: 1, rules }));
}
