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
  const review = page
    .locator("header")
    .getByRole("button", { name: /^Review…/ });
  const reviewPanel = page.getByRole("region", { name: "Review this CV" });
  return {
    review,
    tailor: page.getByRole("button", { name: "Tailor to a job…" }),
    reviewPanel,
    /** Opens the panel and runs a review: opening alone runs nothing. */
    startReview: async () => {
      await review.click();
      await reviewPanel.getByRole("button", { name: /^Review →/ }).click();
    },
  };
}

/** How the mock's next calls end: `failing` (an API error) or `invalid` (an answer that doesn't fit). */
const resetMock = (end: { failing?: boolean; invalid?: boolean } = {}) =>
  fetch(`${mock}/reset`, { method: "POST", body: JSON.stringify(end) });
const mockCalls = async (): Promise<{ model: string }[]> =>
  (await fetch(`${mock}/calls`)).json();

test.beforeEach(() => resetMock());

test.afterEach(async () => {
  const sent = JSON.stringify(await mockCalls());
  for (const value of [contact.name, contact.email, contact.phone])
    expect(sent, "personal data reached the model").not.toContain(value);
});

test("a closed panel keeps its work", async ({ page }) => {
  const { review, tailor, reviewPanel, startReview } = await openNewCv(page);

  await tailor.click();
  const job = page.getByPlaceholder("Paste the whole job posting here.");
  await job.fill("Senior Backend Engineer at Acme");
  await tailor.click();
  await tailor.click();
  await expect(job).toHaveValue("Senior Backend Engineer at Acme");

  await startReview();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  await expect(reviewPanel.getByText("Mock Fast · $0.002")).toBeVisible();
  await review.click();
  await review.click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  expect(await mockCalls()).toHaveLength(1);
});

test("a review keeps running while its panel is closed", async ({ page }) => {
  const { review, reviewPanel, startReview } = await openNewCv(page);

  await startReview();
  await expect(reviewPanel.getByText("Reviewing your CV…")).toBeVisible();
  await reviewPanel.getByRole("button", { name: "Close" }).click();
  await expect(review).toHaveText("Review… · running");

  // A model edit now would leave the running review's result (and its to-dos) behind the CV.
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
  await resetMock({ failing: true });
  const { reviewPanel, startReview } = await openNewCv(page);

  await startReview();
  await reviewPanel.getByRole("button", { name: "Close" }).click();
  await expect(reviewPanel).toBeHidden();
  await expect(reviewPanel.getByRole("alert")).toBeVisible();
});

test("editing while the panel is closed marks the review out of date", async ({
  page,
}) => {
  const { review, reviewPanel, startReview } = await openNewCv(page);

  await startReview();
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

test("the picked model runs, shows its cost, and is the choice of every picker", async ({
  page,
}) => {
  const { review, reviewPanel, startReview } = await openNewCv(page);
  const picker = () => page.getByLabel("Model").filter({ visible: true });

  await startReview();
  await expect(reviewPanel.getByText("Mock Fast · $0.002")).toBeVisible();
  await picker().selectOption("mock-good");
  await reviewPanel.getByRole("button", { name: "Review again" }).click();
  await expect(reviewPanel.getByText("Mock Good · $0.03")).toBeVisible();
  expect((await mockCalls()).map((call) => call.model)).toEqual([
    "mock-fast",
    "mock-good",
  ]);

  // The same choice beside Tighten to fit, and after a reload.
  await review.click();
  await expect(picker()).toHaveValue("mock-good");
  await page.reload();
  await expect(picker()).toHaveValue("mock-good");
});

test("an answer that doesn't fit asks for another model", async ({ page }) => {
  await resetMock({ invalid: true });
  const { reviewPanel, startReview } = await openNewCv(page);

  await startReview();
  await expect(reviewPanel.getByRole("alert")).toHaveText(
    "Mock Fast couldn't produce a valid answer. Nothing was changed. Pick another model and try again.",
  );
});

test("opening Review runs nothing until you click Review", async ({ page }) => {
  const { review, reviewPanel } = await openNewCv(page);

  await review.click();
  await expect(
    reviewPanel.getByRole("heading", { name: "What the review checks" }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(await mockCalls()).toHaveLength(0);
  await reviewPanel.getByRole("button", { name: /^Review →/ }).click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  expect(await mockCalls()).toHaveLength(1);
});

test("an edited checklist rule is what the model receives", async ({
  page,
}) => {
  const { review, reviewPanel } = await openNewCv(page);
  const checklist = reviewPanel.getByRole("region", {
    name: "What the review checks",
  });

  await review.click();
  await checklist.getByRole("button", { name: "Edit" }).click();
  // The third rule's text: Tense.
  await checklist.locator("textarea").nth(2).fill("Use past tense everywhere.");
  await checklist.getByRole("button", { name: "Done" }).click();
  await expect(checklist.getByText("Use past tense everywhere.")).toBeVisible();
  await reviewPanel.getByRole("button", { name: /^Review →/ }).click();
  await expect(reviewPanel.getByText("2 suggestions")).toBeVisible();
  const sent = JSON.stringify(await mockCalls());
  expect(sent).toContain("Tense: Use past tense everywhere.");
  expect(sent).not.toContain("Present tense for the current role");

  // Back to the default, for the other tests: the checklist is saved for every CV.
  await reviewPanel.getByRole("button", { name: "your checklist" }).click();
  await checklist.getByRole("button", { name: "Edit" }).click();
  await checklist.getByRole("button", { name: "Reset to default" }).click();
  await checklist.getByRole("button", { name: "Done" }).click();
  await expect(
    checklist.getByText("Present tense for the current role"),
  ).toBeVisible();
});

test("what needs your input stays on its entry until you mark it done", async ({
  page,
}) => {
  const { reviewPanel, startReview } = await openNewCv(page);
  const note = page.getByText("To do · Impact:");

  await startReview();
  await expect(reviewPanel.getByText("Needs your input · 1")).toBeVisible();
  await reviewPanel.getByRole("button", { name: "Go to field" }).click();
  await expect(note).toBeVisible();

  await page.reload();
  const entry = page.locator("summary").filter({ hasText: "Orbital Pay" });
  await expect(entry.getByText("To do")).toBeVisible();
  await entry.click();
  await expect(note).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(note).toBeHidden();
  await page.reload();
  await expect(entry.getByText("To do")).toBeHidden();
});

test("Ask for something else works without a review first", async ({
  page,
}) => {
  const { review, reviewPanel } = await openNewCv(page);

  await review.click();
  await reviewPanel
    .getByRole("button", { name: /Ask for something else/ })
    .click();
  await reviewPanel
    .getByLabel(/Add something only you know/)
    .fill("Payouts got 40% faster after the ledger redesign.");
  await reviewPanel.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(async () => JSON.stringify(await mockCalls()))
    .toContain("Payouts got 40% faster");
});

test("after Ask or Apply the panel stays where you were", async ({ page }) => {
  const { review, reviewPanel, startReview } = await openNewCv(page);
  const ask = reviewPanel.getByLabel(/Add something only you know/);

  await review.click();
  await reviewPanel
    .getByRole("button", { name: /Ask for something else/ })
    .click();
  await ask.fill("Put the payments service first.");
  await reviewPanel.getByRole("button", { name: "Send" }).click();
  await expect(
    reviewPanel.getByText("Done, highlighted in the form."),
  ).toBeVisible();
  await expect(ask).toHaveValue("");
  // The edit is in the form, highlighted, without reloading the editor.
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(
    "Backend engineer (edited)",
  );
  // The panel stays; the banner opens the edit's card.
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(
    page.getByRole("article", { name: "Headline" }).getByText("(edited)"),
  ).toBeVisible();

  await startReview();
  await reviewPanel.getByRole("button", { name: "Apply 1 fix →" }).click();
  await expect(
    reviewPanel.getByText("1 fix applied, highlighted in the form."),
  ).toBeVisible();
  await expect(reviewPanel.getByText("Needs your input · 1")).toBeVisible();
});

test("tailoring applies only what you tick, and each change is kept or reverted on its card", async ({
  page,
}) => {
  const { tailor } = await openNewCv(page);
  const editorUrl = page.url();

  await tailor.click();
  await page
    .getByLabel("Job description")
    .fill("Platform Engineer at Halden. ".repeat(10));
  await page.getByRole("button", { name: "Analyze match →" }).click();
  await expect(
    page.getByRole("heading", { name: "What to change" }),
  ).toBeVisible();
  await page.getByLabel("Open the Orbital Pay bullets with on-call").uncheck();
  await page
    .getByRole("button", { name: "Create variant, applying 2 edits →" })
    .click();

  // The variant opens on its changes.
  await expect(page).not.toHaveURL(editorUrl);
  await expect(
    page.getByRole("tab", { name: "Changes · 1", selected: true }),
  ).toBeVisible();
  const sent = JSON.stringify(await mockCalls());
  expect(sent).toContain("Lead the headline with Platform Engineer");
  expect(sent).not.toContain("Open the Orbital Pay bullets with on-call");

  await page
    .getByRole("article", { name: "Headline" })
    .getByRole("button", { name: "Revert" })
    .click();
  await expect(page.getByLabel("Headline", { exact: true })).toHaveValue(
    "Backend engineer",
  );
  await expect(page.getByText("All changes reviewed")).toBeVisible();
});
