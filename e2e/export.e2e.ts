import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { emptyContent } from "@/lib/cv/empty";
import { extractLines } from "@/lib/pdf/extract";
import { createCv } from "@/lib/store/cvs";

test("Export PDF downloads the CV as one A4 page of real text", async ({
  page,
}) => {
  const cv = await createCv("Base CV", {
    contact: {
      name: "Alex Moreno",
      email: "alex.moreno@example.com",
      phone: "",
      location: "Lisbon",
      dateOfBirth: "",
      links: [],
    },
    content: {
      ...emptyContent(),
      headline: "Backend engineer",
      summary: "Builds payment systems that stay up.",
    },
  });
  await page.goto(`/cv/${cv.id}`);
  // Edited just before exporting: the PDF must have it.
  await page.getByLabel("Headline", { exact: true }).fill("Staff engineer");

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Alex-Moreno_Base-CV.pdf");

  const { lines, pageCount } = await extractLines(
    new Uint8Array(await readFile(await download.path())),
  );
  expect(pageCount).toBe(1);
  const text = lines.map((line) => line.text).join("\n");
  expect(text).toContain("Alex Moreno");
  expect(text).toContain("Staff engineer");
});
