import type { NextRequest } from "next/server";
import { exportFileName } from "@/lib/cv/page";
import { renderPdf } from "@/lib/pdf/render";
import { getCv } from "@/lib/store/cvs";

/** The CV as a PDF download, rendered from its print view. Errors come back as plain text to show. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/cv/[id]/pdf">,
) {
  const { id } = await params;
  const cv = await getCv(id);
  if (!cv) return new Response("This CV no longer exists.", { status: 404 });
  try {
    // Chromium on this machine loads the app itself, never the host the request names.
    const app = `http://localhost:${request.nextUrl.port}`;
    const pdf = await renderPdf(new URL(`/cv/${id}/print`, app));
    const name = exportFileName(cv.contact.name, cv.job?.company || cv.title);
    // A Uint8Array view: the Response types don't take a Node Buffer.
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // The name can have accents, which a plain header value can't carry.
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.pdf`,
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      error instanceof Error ? error.message : "Couldn't make the PDF.",
      { status: 500 },
    );
  }
}
