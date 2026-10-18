import { expect, test, type Page } from "@playwright/test";

import {
  loadSample,
  openAllSections,
  stageCultRename,
} from "./helpers";

// Font rendering differs between operating systems, so baselines are made
// and compared only on Linux: in CI, or locally with `pnpm e2e:docker`.
test.skip(
  process.platform !== "linux",
  "Screenshot baselines are Linux-only; run `pnpm e2e:docker`.",
);

test.use({ reducedMotion: "reduce" });

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  // Toasts come and go on timers, and the change dock floats over whatever
  // happens to be scrolled under it; either would make captures racy.
  await page.addStyleTag({
    content: ".action-toast, .change-dock { display: none; }",
  });
  // Park the pointer so no row is captured in its hover state.
  await page.mouse.move(0, 0);
}

const capture = { fullPage: true, animations: "disabled", caret: "hide" } as const;

test("landing page", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  await expect(page).toHaveScreenshot("landing.png", capture);
});

// The loaded page is captured a section at a time: a single full-page image
// with everything open is tens of megabytes of baseline, and a failing diff
// would not say which part of the page changed.
test.describe("loaded save", () => {
  test.beforeEach(async ({ page }) => {
    await loadSample(page);
    await stageCultRename(page, "Playwright Cult");
  });

  test("summary", async ({ page }) => {
    await settle(page);
    await expect(page.locator("#report")).toHaveScreenshot("summary.png", {
      ...capture,
      // The file-modified time comes from the moment the sample was fetched.
      mask: [
        page
          .locator("dt", { hasText: /file modified/i })
          .locator("xpath=following-sibling::dd[1]"),
      ],
    });
  });

  for (const title of [
    "Followers",
    "Resources",
    "Doctrines",
    "Rituals and sermons",
  ]) {
    test(`${title} panel`, async ({ page }) => {
      const panel = page
        .locator("details.overview-panel")
        .filter({ has: page.locator("summary strong", { hasText: title }) });
      // Follower entries all share one layout, so only the first is opened.
      await panel.evaluate((root) => {
        (root as HTMLDetailsElement).open = true;
        const firstFollower = root.querySelector("details.follower-entry");
        root.querySelectorAll("details").forEach((d) => {
          const entry = d.closest("details.follower-entry");
          (d as HTMLDetailsElement).open =
            entry === null || entry === firstFollower;
        });
      });
      await settle(page);
      const name = `${title.toLowerCase().replaceAll(" ", "-")}-panel.png`;
      await expect(panel).toHaveScreenshot(name, capture);
    });
  }

  test("download section", async ({ page }) => {
    const section = page.locator("#edited-save-download");
    await section.evaluate((root) =>
      root
        .querySelectorAll("details")
        .forEach((d) => ((d as HTMLDetailsElement).open = true)),
    );
    await settle(page);
    await expect(section).toHaveScreenshot("download-section.png", capture);
  });
});

test("follower editor", async ({ page }) => {
  await loadSample(page);
  await openAllSections(page);
  await page
    .locator('.follower-edit-actions button[aria-label^="Edit "]')
    .first()
    .click();
  await settle(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "follower-editor.png",
    capture,
  );
});

test("download review", async ({ page }) => {
  await loadSample(page);
  await stageCultRename(page, "Playwright Cult");
  await page.getByRole("button", { name: "Review edited file" }).click();
  await settle(page);
  await expect(page.getByRole("dialog")).toHaveScreenshot(
    "download-review.png",
    capture,
  );
});
