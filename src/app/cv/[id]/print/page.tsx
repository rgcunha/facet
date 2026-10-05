import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { exportFileName, PAGE_VARS, PRINT_PAGE_CSS } from "@/lib/cv/page";
import { getCv } from "@/lib/store/cvs";
import { Classic } from "@/templates/Classic";
import { AutoPrint } from "./auto-print";

// Shared by generateMetadata and the page within one request.
const load = cache(async (id: string) => {
  const cv = await getCv(id);
  if (!cv) notFound();
  return cv;
});

/** Browsers use the document title as the default PDF file name. */
export async function generateMetadata({
  params,
}: PageProps<"/cv/[id]/print">): Promise<Metadata> {
  const cv = await load((await params).id);
  return {
    title: exportFileName(cv.contact.name, cv.job?.company || cv.title),
  };
}

/** Print-only view: the browser's "Save as PDF" turns this into the exported file. */
export default async function PrintPage({
  params,
}: PageProps<"/cv/[id]/print">) {
  const cv = await load((await params).id);

  return (
    <main
      className="mx-auto my-8 w-(--page-w) bg-white px-(--page-mx) py-(--page-my) shadow-lg print:my-0 print:w-auto print:p-0 print:shadow-none"
      style={PAGE_VARS}
    >
      <style>{PRINT_PAGE_CSS}</style>
      <Classic contact={cv.contact} content={cv.content} />
      <AutoPrint />
    </main>
  );
}
