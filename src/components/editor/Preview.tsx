"use client";

import { memo, useDeferredValue, useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { plural } from "@/lib/cv/format";
import { PAGE, PAGE_CONTENT_HEIGHT_MM, PX_PER_MM } from "@/lib/cv/page";
import type { Contact, CvContent, EditorValues } from "@/lib/cv/schema";
import { Classic } from "@/templates/Classic";

const PAGE_WIDTH_PX = PAGE.widthMm * PX_PER_MM;
const PAGE_CONTENT_PX = PAGE_CONTENT_HEIGHT_MM * PX_PER_MM;
const PAGE_HEIGHT_PX = PAGE.heightMm * PX_PER_MM;
const PAGE_MARGINS_Y_PX = 2 * PAGE.marginYMm * PX_PER_MM;
// Re-measuring after a render (setSize) must not re-render the whole CV again.
const Template = memo(Classic);
/** An A4 sheet with the print margins; both tabs draw the CV on one of these. */
const SHEET_CLASS =
  "bg-white shadow-[0_1px_3px_rgba(21,24,30,.12),0_8px_24px_rgba(21,24,30,.08)]";
const SHEET_STYLE = {
  width: `${PAGE.widthMm}mm`,
  minHeight: `${PAGE.heightMm}mm`,
  padding: `${PAGE.marginYMm}mm ${PAGE.marginXMm}mm`,
};

/**
 * Live A4 preview, scaled to fit the pane, with a page-fit indicator and page-break guides.
 * A second tab compares with the original PDF (imported CV) or the base CV (tailored variant).
 */
export function Preview({
  sourceUrl,
  base,
  showSecond = false,
  onTighten,
  tightening = false,
}: {
  sourceUrl?: string;
  base?: { contact: Contact; content: CvContent };
  showSecond?: boolean;
  /** Offered when the CV runs over its page target. */
  onTighten?: (overflowLines: number) => void;
  tightening?: boolean;
}) {
  const second = sourceUrl
    ? { label: "Original PDF" }
    : base && { label: "Base CV" };
  const [tab, setTab] = useState<"preview" | "second">(
    second && showSecond ? "second" : "preview",
  );
  // Once opened, the second tab stays mounted (just hidden), e.g. so a PDF isn't re-fetched.
  const [secondOpened, setSecondOpened] = useState(tab === "second");
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
        {second ? (
          <div
            role="tablist"
            aria-label="Right pane"
            className="flex overflow-hidden rounded-lg border border-field"
          >
            {(["preview", "second"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  if (t === "second") setSecondOpened(true);
                }}
                className={`min-h-[38px] px-3.5 ${tab === t ? "bg-ink font-semibold text-white" : "bg-white text-ink"}`}
              >
                {t === "preview" ? "Preview" : second.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="font-semibold">Preview</span>
        )}
        <span
          role="status"
          className={`ml-auto text-sm font-semibold ${fits ? "text-ok" : "text-warn"}`}
        >
          {fits
            ? `Fits on ${plural(pagesUsed, "page")}`
            : `${plural(overflowLines, "line")} over ${plural(target, "page")}`}
        </span>
        {!fits && onTighten && (
          <button
            type="button"
            className="btn-secondary min-h-[38px]"
            disabled={tightening}
            onClick={() => onTighten(overflowLines)}
          >
            {tightening ? "Tightening…" : "Tighten to fit"}
          </button>
        )}
      </div>
      {secondOpened && sourceUrl && (
        <iframe
          hidden={tab !== "second"}
          title="Original PDF"
          src={sourceUrl}
          className="block h-[1100px] w-full border-0 bg-white"
        />
      )}
      {tab === "second" && base && (
        <div className="p-6">
          {/* Same sheet and scale as the preview; zoom (not transform) so its height needs no measuring. */}
          <div
            className={`mx-auto ${SHEET_CLASS}`}
            style={{ ...SHEET_STYLE, zoom: size.scale }}
          >
            <Template contact={base.contact} content={base.content} />
          </div>
        </div>
      )}
      {/* Behind the second tab the preview stays laid out (just invisible), so page fit is still measured. */}
      <div
        ref={paneRef}
        className={
          tab === "second" ? "invisible h-0 overflow-hidden px-6" : "p-6"
        }
      >
        <div
          className="mx-auto"
          style={{
            width: PAGE_WIDTH_PX * size.scale,
            height: pagePx * size.scale,
          }}
        >
          <div
            className={`relative origin-top-left ${SHEET_CLASS}`}
            style={{ ...SHEET_STYLE, transform: `scale(${size.scale})` }}
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
