import { expect, test, type Page } from "@playwright/test";

import { loadSample, openAllSections } from "./helpers";

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
}

test("the landing page does not scroll sideways", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expectNoSidewaysScroll(page);
});

test("a loaded save does not scroll sideways", async ({ page }) => {
  await loadSample(page);
  await openAllSections(page);
  await page.evaluate(() => document.fonts.ready);
  await expectNoSidewaysScroll(page);
});
