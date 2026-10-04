import { getCv } from "@/lib/store/cvs";
import { getSourcePdf } from "@/lib/store/sources";

/** The original imported PDF, shown in the editor's "Original PDF" tab by the browser's own viewer. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/cv/[id]/source">,
) {
  const cv = await getCv((await params).id);
  const pdf = cv?.sourcePdf ? await getSourcePdf(cv.sourcePdf) : null;
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      // A source PDF never changes once imported.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
