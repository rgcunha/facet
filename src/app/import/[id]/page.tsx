import { notFound } from "next/navigation";
import { ModelsProvider } from "@/components/model";
import { modelsOrError } from "@/lib/llm/models";
import { getImport } from "@/lib/store/imports";
import { ImportReview } from "./import-review";

export default async function ImportPage({
  params,
}: PageProps<"/import/[id]">) {
  const draft = await getImport((await params).id);
  if (!draft) notFound();
  return (
    <ModelsProvider {...modelsOrError()}>
      <ImportReview draft={draft} />
    </ModelsProvider>
  );
}
