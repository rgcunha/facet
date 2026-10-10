import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { ModelsProvider } from "@/components/model";
import { modelsOrError } from "@/lib/llm/models";
import { getChecklist } from "@/lib/store/checklist";
import { getBase, getCv } from "@/lib/store/cvs";

export default async function EditorPage({
  params,
  searchParams,
}: PageProps<"/cv/[id]">) {
  const { id } = await params;
  const [cv, query, checklist] = await Promise.all([
    getCv(id),
    searchParams,
    getChecklist(),
  ]);
  if (!cv) notFound();
  const base = cv.baseId ? await getBase(cv) : null; // null too if the base was deleted

  return (
    <ModelsProvider {...modelsOrError()}>
      <Editor
        // A new editor for another CV. Edits by the model (Apply, Ask, Tighten) are loaded into the form instead.
        key={cv.id}
        id={cv.id}
        defaultValues={{
          title: cv.title,
          pages: cv.pages,
          template: cv.template,
          contact: cv.contact,
          content: cv.content,
          changes: cv.changes,
        }}
        sourceUrl={cv.sourcePdf ? `/cv/${cv.id}/source` : undefined}
        justImported={query.imported === "1"}
        job={cv.job}
        base={base ?? undefined}
        openTailor={query.tailor === "1"}
        lastRun={cv.lastRun}
        checklist={checklist}
        todos={cv.todos}
      />
    </ModelsProvider>
  );
}
