import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { getBase, getCv } from "@/lib/store/cvs";

export default async function EditorPage({
  params,
  searchParams,
}: PageProps<"/cv/[id]">) {
  const { id } = await params;
  const [cv, query] = await Promise.all([getCv(id), searchParams]);
  if (!cv) notFound();
  const base = cv.baseId ? await getBase(cv) : null; // null too if the base was deleted

  return (
    <Editor
      // Remount when the CV changed on the server (e.g. "Tighten to fit"), so the form reloads.
      key={cv.updatedAt}
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
    />
  );
}
