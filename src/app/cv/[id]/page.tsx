import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { getCv } from "@/lib/store/cvs";
import { getProfile } from "@/lib/store/profile";

export default async function EditorPage({
  params,
  searchParams,
}: PageProps<"/cv/[id]">) {
  const { id } = await params;
  const [cv, profile, query] = await Promise.all([
    getCv(id),
    getProfile(),
    searchParams,
  ]);
  if (!cv) notFound();

  return (
    <Editor
      id={cv.id}
      defaultValues={{
        title: cv.title,
        pages: cv.pages,
        contact: profile.contact,
        content: cv.content,
      }}
      sourceUrl={cv.sourcePdf ? `/cv/${cv.id}/source` : undefined}
      justImported={query.imported === "1"}
    />
  );
}
