import { notFound } from "next/navigation";
import { PRINT_PAGE_CSS } from "@/lib/cv/page";
import { getCv } from "@/lib/store/cvs";
import { TEMPLATES } from "@/templates";

/** What the PDF route prints in headless Chromium: the CV on A4, with the margins as `@page` rules. */
export default async function PrintPage({
  params,
}: PageProps<"/cv/[id]/print">) {
  const cv = await getCv((await params).id);
  if (!cv) notFound();
  const Template = TEMPLATES[cv.template];

  return (
    <main>
      <style>{PRINT_PAGE_CSS}</style>
      <Template contact={cv.contact} content={cv.content} />
    </main>
  );
}
