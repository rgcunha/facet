import { expect, type Page, test } from "@playwright/test";
import { createCv } from "@/lib/store/cvs";

const mock = new URL(process.env.LLM_BASE_URL!).origin;
const contact = {
  name: "Alex Moreno",
  email: "alex.moreno@example.com",
  phone: "+351 912 000 000",
  location: "Lisbon",
  dateOfBirth: "",
  links: [],
};

/** A made-up CV, long enough to run over one page so "Tighten to fit" shows. */
async function openNewCv(page: Page) {
  const tooling = Array.from(
    { length: 40 },
    (_, i) => `Built internal tool ${i + 1} for the payments team`,
  );
  const cv = await createCv("E2E CV", {
    contact,
    content: {
      headline: "Backend engineer",
      summary: "I am a engineer who builds payment systems.",
      experience: [
        {
          id: "e1",
          role: "Lead Backend Engineer",
          company: "Orbital Pay",
          location: "Lisbon",
          start: "2021",
          end: "2024",
          highlights: ["Responsible for payments service", ...tooling],
        },
      ],
      education: [],
      skills: [],
      projects: [],
      languages: [],
      extras: [],
    },
  });
  await page.goto(`/cv/${cv.id}`);
  return {
    review: page.locator("header").getByRole("button", { name: /^Review…/ }),
    tailor: page.getByRole("button", { name: "Tailor to a job…" }),
    reviewPanel: page.getByRole("region", { name: "Review this CV" }),
  };
}

const resetMock = (failing = false) =>
  fetch(`${mock}/reset`, { method: "POST", body: JSON.stringify({ failing }) });
const mockCalls = async () => (await fetch(`${mock}/calls`)).json();

test.beforeEach(() => resetMock());

test.afterEach(async () => {
  const sent = JSON.stringify(await mockCalls());
  for (const value of [contact.name, contact.email, contact.phone])
    expect(sent, "personal data reached the model").not.toContain(value);
});

test("a closed panel keeps its work", async ({ page }) => {
  const { review, tailor, reviewPanel } = await openNewCv(page);

  await tailor.click();
  const job = page.getByPlaceholder("Paste the whole job posting here.");
  await job.fill("Senior Backend Engineer at Acme");
  await tailor.click();
  await tailor.click();
  await expect(job).toHaveValue("Senior Backend Engineer at Acme");

  await review.click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  await review.click();
  await review.click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  expect(await mockCalls()).toHaveLength(1);
});

test("a review keeps running while its panel is closed", async ({ page }) => {
  const { review, reviewPanel } = await openNewCv(page);

  await review.click();
  await expect(reviewPanel.getByText("Reviewing your CV…")).toBeVisible();
  await reviewPanel.getByRole("button", { name: "Close" }).click();
  await expect(review).toHaveText("Review… · running");

  // Tightening reloads the editor, which would discard the running review.
  await page.getByRole("button", { name: "Tighten to fit" }).click();
  const wait = page.getByText("Wait for the Review or Tailor panel to finish");
  await expect(wait).toBeVisible();

  await expect(review).toHaveText("Review…");
  await expect(wait).toBeHidden();
  await review.click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  expect(await mockCalls()).toHaveLength(1);
});

test("a review that fails while closed reopens its panel", async ({ page }) => {
  await resetMock(true);
  const { review, reviewPanel } = await openNewCv(page);

  await review.click();
  await reviewPanel.getByRole("button", { name: "Close" }).click();
  await expect(reviewPanel).toBeHidden();
  await expect(reviewPanel.getByRole("alert")).toBeVisible();
});

test("editing while the panel is closed marks the review out of date", async ({
  page,
}) => {
  const { review, reviewPanel } = await openNewCv(page);

  await review.click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  await review.click();
  await page.getByLabel("Headline", { exact: true }).fill("Senior engineer");
  await review.click();
  await expect(
    reviewPanel.getByText("You edited the CV after this review"),
  ).toBeVisible();
  await expect(
    reviewPanel.getByRole("button", { name: /Apply|Nothing to apply/ }),
  ).toBeDisabled();
});
