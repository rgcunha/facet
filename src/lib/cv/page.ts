import type { CSSProperties } from "react";

/** A4 page geometry shared by the live preview (page-fit) and the print route (@page rule). */
export const PAGE = {
  widthMm: 210,
  heightMm: 297,
  marginXMm: 18,
  marginYMm: 16,
} as const;

export const PAGE_CONTENT_HEIGHT_MM = PAGE.heightMm - 2 * PAGE.marginYMm;

export const PX_PER_MM = 96 / 25.4;

/** Screen view of the print route: an A4 sheet with the print margins as padding (removed when printing). */
export const PAGE_VARS = {
  "--page-w": `${PAGE.widthMm}mm`,
  "--page-mx": `${PAGE.marginXMm}mm`,
  "--page-my": `${PAGE.marginYMm}mm`,
} as CSSProperties;

export const PRINT_PAGE_CSS = `@page { size: A4; margin: ${PAGE.marginYMm}mm ${PAGE.marginXMm}mm; }`;

/** "Alex Moreno" + "Senior Backend Engineer" -> "Alex-Moreno_Senior-Backend-Engineer" */
export function exportFileName(name: string, title: string) {
  const part = (s: string) =>
    s
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "");
  return [part(name), part(title)].filter(Boolean).join("_") || "CV";
}
