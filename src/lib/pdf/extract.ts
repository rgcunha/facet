import { extractTextItems } from "unpdf";

/** A line of PDF text with the largest font size used on it (the name is usually the biggest text). */
export type TextLine = { text: string; size: number };

/** Fewer characters than this means a scanned PDF without a text layer. */
const MIN_TEXT_LENGTH = 50;

/** pdf.js can split text runs inside an email ("alex@ example.com"); rejoin so detection sees it whole. */
const clean = (text: string) => text.trim().replace(/\s*@\s*/g, "@");

/** Reads the PDF locally with pdf.js: text lines in reading order, each with its largest font size. */
export async function extractLines(bytes: Uint8Array) {
  // pdf.js takes ownership of (detaches) the buffer it is given; callers still need theirs.
  const { totalPages, items } = await extractTextItems(bytes.slice());
  const lines: TextLine[] = [];
  let current: TextLine = { text: "", size: 0 };
  const endLine = () => {
    if (current.text.trim())
      lines.push({ ...current, text: clean(current.text) });
    current = { text: "", size: 0 };
  };
  for (const page of items) {
    for (const item of page) {
      current.text += item.str;
      current.size = Math.max(current.size, item.fontSize);
      if (item.hasEOL) endLine();
    }
    endLine();
  }
  if (lines.reduce((n, l) => n + l.text.length, 0) < MIN_TEXT_LENGTH)
    throw new Error(
      "This PDF has no selectable text (probably a scan). Export it as a text PDF from your editor, or start from an empty CV.",
    );
  return { lines, pageCount: totalPages };
}
