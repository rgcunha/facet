import { chromium } from "playwright";

/**
 * Prints a page of this app to a PDF in headless Chromium, the engine the preview is checked in, so
 * the file matches what the editor shows. The page's `@page` CSS sets the paper size and margins.
 */
export async function renderPdf(url: URL) {
  const browser = await launch().catch((error: unknown) => {
    throw new Error(
      isMissing(error)
        ? "The PDF renderer isn't installed. Install Google Chrome, or run `bunx playwright install chromium`, then export again."
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

/** Playwright's own Chromium if it was installed, else the user's Google Chrome (the macOS bundle ships neither). */
const launch = () =>
  chromium.launch().catch((error: unknown) => {
    if (!isMissing(error)) throw error;
    return chromium.launch({ channel: "chrome" });
  });

const isMissing = (error: unknown) =>
  error instanceof Error &&
  /Executable doesn't exist|distribution '.+' is not found/.test(error.message);
