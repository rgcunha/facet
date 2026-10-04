"use client";

import { memo, useDeferredValue, useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { PAGE, PAGE_CONTENT_HEIGHT_MM, PX_PER_MM } from "@/lib/cv/page";
import type { EditorValues } from "@/lib/cv/schema";
import { Classic } from "@/templates/Classic";

const PAGE_WIDTH_PX = PAGE.widthMm * PX_PER_MM;
const PAGE_CONTENT_PX = PAGE_CONTENT_HEIGHT_MM * PX_PER_MM;
const PAGE_HEIGHT_PX = PAGE.heightMm * PX_PER_MM;
const PAGE_MARGINS_Y_PX = 2 * PAGE.marginYMm * PX_PER_MM;
// Re-measuring after a render (setSize) must not re-render the whole CV again.
const Template = memo(Classic);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Live A4 preview, scaled to fit the pane, with a page-fit indicator and page-break guides. */
export function Preview() {
  // Deferred, so typing stays responsive while the preview catches up.
  const values = useDeferredValue(useWatch<EditorValues>() as EditorValues);
  const paneRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ contentPx: 0, linePx: 1, scale: 1 });

  useEffect(() => {
    const pane = paneRef.current;
    const content = contentRef.current;
    if (!pane || !content) return;
    const measure = () => {
      const article = content.firstElementChild;
      setSize({
        contentPx: content.offsetHeight,
        linePx: article
          ? parseFloat(getComputedStyle(article).lineHeight) || 1
          : 1,
        scale: Math.min(1, (pane.clientWidth - 48) / PAGE_WIDTH_PX),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const target = values.pages;
  const pagesUsed = Math.max(1, Math.ceil(size.contentPx / PAGE_CONTENT_PX));
  const overflowLines = Math.ceil(
    (size.contentPx - target * PAGE_CONTENT_PX) / size.linePx,
  );
  const fits = overflowLines <= 0;
  const pagePx = Math.max(PAGE_HEIGHT_PX, size.contentPx + PAGE_MARGINS_Y_PX);

  return (
    <section
      aria-label="Preview"
      className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-xl bg-preview"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2.5">
        <span className="font-semibold">Preview</span>
        <span
          role="status"
          className={`ml-auto text-sm font-semibold ${fits ? "text-ok" : "text-warn"}`}
        >
          {fits
            ? `Fits on ${plural(pagesUsed, "page")}`
            : `${plural(overflowLines, "line")} over ${plural(target, "page")}`}
        </span>
      </div>
      <div ref={paneRef} className="p-6">
        <div
          className="mx-auto"
          style={{
            width: PAGE_WIDTH_PX * size.scale,
            height: pagePx * size.scale,
          }}
        >
          <div
            className="relative origin-top-left bg-white shadow-[0_1px_3px_rgba(21,24,30,.12),0_8px_24px_rgba(21,24,30,.08)]"
            style={{
              width: `${PAGE.widthMm}mm`,
              minHeight: `${PAGE.heightMm}mm`,
              padding: `${PAGE.marginYMm}mm ${PAGE.marginXMm}mm`,
              transform: `scale(${size.scale})`,
            }}
          >
            <div ref={contentRef}>
              <Template contact={values.contact} content={values.content} />
            </div>
            {Array.from({ length: pagesUsed - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className={`absolute inset-x-0 border-t-2 border-dashed px-2 text-right font-sans text-[11px] font-semibold ${i + 1 >= target ? "border-warn text-warn" : "border-muted text-muted"}`}
                style={{
                  top: `${PAGE.marginYMm + (i + 1) * PAGE_CONTENT_HEIGHT_MM}mm`,
                }}
              >
                Page {i + 2}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
