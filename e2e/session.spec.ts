import { expect, test } from "@playwright/test";

import {
  SAMPLE_SAVE_NAME,
  loadSample,
  stageCultRename,
  waitForCachedSession,
  waitForClearedSession,
} from "./helpers";

test("a reload restores the open save and its staged edits", async ({
  page,
}) => {
  await loadSample(page);
  await stageCultRename(page, "Persisted Cult");
  await waitForCachedSession(page, "Persisted Cult");

  await page.reload();
  await expect(
    page.getByText(`Restored your last session with ${SAMPLE_SAVE_NAME}.`),
  ).toBeVisible();
  await expect(
    page.getByText(`${SAMPLE_SAVE_NAME} successfully loaded`),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Pending changes" }),
  ).toContainText("Persisted Cult");
});

test("removing the save clears it from the next visit", async ({ page }) => {
  await loadSample(page);
  await stageCultRename(page, "Forgotten Cult");
  await waitForCachedSession(page, "Forgotten Cult");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Choose a save")).toBeVisible();
  await waitForClearedSession(page);

  await page.reload();
  await expect(page.getByText("Choose a save")).toBeVisible();
  await expect(page.getByText(/successfully loaded/)).toHaveCount(0);
});
