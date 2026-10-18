import { isDeepStrictEqual } from "node:util";

import { expect, test } from "@playwright/test";

import {
  SAMPLE_SAVE_PATH,
  decodeFile,
  loadSample,
  stageCultRename,
  stageFollowerRename,
} from "./helpers";

test("edits made in the browser land in the downloaded save and nowhere else", async ({
  page,
}, testInfo) => {
  await loadSample(page);
  await stageCultRename(page, "Playwright Cult");
  const original = await stageFollowerRename(page, "Pw");

  await page.getByRole("button", { name: "Review edited file" }).click();
  const review = page.getByRole("dialog");
  await expect(review.getByText("Playwright Cult")).toBeVisible();
  for (const box of await review.getByRole("checkbox").all()) {
    await box.check();
  }
  const download = page.waitForEvent("download");
  await review
    .getByRole("button", { name: /^Verify and download/ })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("sample_slot_0.edited.mp");
  const path = testInfo.outputPath(file.suggestedFilename());
  await file.saveAs(path);

  const before = (await decodeFile(SAMPLE_SAVE_PATH)).data;
  const after = (await decodeFile(path)).data;
  expect(after.CultName).toBe("Playwright Cult");

  const names = (followers: unknown) =>
    (followers as { _name: string }[]).map((f) => f._name);
  const beforeNames = names(before.Followers);
  const afterNames = names(after.Followers);
  expect(afterNames).toEqual(
    beforeNames.map((name) => (name === original ? "Pw" : name)),
  );

  const changed = Object.keys(before).filter(
    (key) => !isDeepStrictEqual(before[key], after[key]),
  );
  expect(changed.sort()).toEqual(["CultName", "Followers"]);
});
