import { chromium } from "playwright";

/**
 * Prints a page of this app to a PDF in headless Chromium, the engine the preview is checked in, so
 * the file matches what the editor shows. The page's `@page` CSS sets the paper size and margins.
 */
export async function renderPdf(url: URL) {
  const browser = await chromium.launch().catch((error: unknown) => {
    throw new Error(
      error instanceof Error &&
        error.message.includes("Executable doesn't exist")
        ? "The PDF renderer isn't installed. Run `bunx playwright install chromium`, then export again."
        : "The PDF renderer couldn't start.",
      { cause: error },
    );
  });
  try {
    const page = await browser.newPage();
    const response = await page.goto(url.href, { waitUntil: "load" });
    if (!response?.ok())
      throw new Error(`The CV's print view failed (${response?.status()}).`);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    return await page.pdf({ preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}
