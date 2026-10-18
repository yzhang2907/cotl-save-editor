import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { expect, type Page } from "@playwright/test";

import { decodeSave } from "../src/save/decode";
import type { DecodedSave } from "../src/save/types";

export const SAMPLE_SAVE_NAME = "sample_slot_0.mp";
export const SAMPLE_SAVE_PATH = fileURLToPath(
  new URL(`../public/samples/${SAMPLE_SAVE_NAME}`, import.meta.url),
);

export async function decodeFile(path: string): Promise<DecodedSave> {
  return decodeSave(new Uint8Array(await readFile(path)).slice().buffer);
}

export async function loadSample(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Try a sample save" }).click();
  await expect(
    page.getByText(`${SAMPLE_SAVE_NAME} successfully loaded`),
  ).toBeVisible();
}

export async function stageCultRename(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Rename the cult" }).click();
  await page.getByLabel("New cult name").fill(name);
  await page.getByRole("button", { name: "Stage the cult name edit" }).click();
}

export async function openAllSections(page: Page): Promise<void> {
  await page.evaluate(() =>
    document.querySelectorAll("details").forEach((d) => (d.open = true)),
  );
}

// Renames the first editable follower and returns their original name.
export async function stageFollowerRename(
  page: Page,
  name: string,
): Promise<string> {
  await openAllSections(page);
  const edit = page
    .locator('.follower-edit-actions button[aria-label^="Edit "]')
    .first();
  const original = (await edit.getAttribute("aria-label"))!.slice("Edit ".length);
  await edit.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: `Rename ${original}` }).click();
  await dialog.getByLabel("New follower name").fill(name);
  await dialog.getByRole("button", { name: "Set the follower's name" }).click();
  await dialog.getByRole("button", { name: "Stage the edits" }).click();
  await expect(dialog).toBeHidden();
  return original;
}

function readCachedSession(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open("cotl-save-editor");
        open.onerror = () => resolve("");
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("session")) {
            resolve("null");
            return;
          }
          const get = db
            .transaction("session")
            .objectStore("session")
            .get("current");
          get.onsuccess = () =>
            resolve(
              JSON.stringify(get.result ?? null, (_key, value: unknown) =>
                value instanceof ArrayBuffer ? undefined : value,
              ),
            );
          get.onerror = () => resolve("");
        };
      }),
  );
}

// Waits for the IndexedDB session record to include the given text, so a
// reload is guaranteed to see the latest staged edits.
export async function waitForCachedSession(
  page: Page,
  text: string,
): Promise<void> {
  await expect.poll(() => readCachedSession(page)).toContain(text);
}

// The session is cleared asynchronously; a reload before the delete commits
// would abort it.
export async function waitForClearedSession(page: Page): Promise<void> {
  await expect.poll(() => readCachedSession(page)).toBe("null");
}
