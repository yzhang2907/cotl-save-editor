import { expect, test } from "@playwright/test";

const cases = [
  {
    name: "a file that is not a save",
    file: { name: "slot_0.mp", buffer: Buffer.from("not a save") },
    message: "This is not a recognized Cult of the Lamb JSON or encrypted save.",
  },
  {
    name: "an unrelated JSON file",
    file: { name: "package.json", buffer: Buffer.from('{"name":"x"}') },
    message: /does not look like a Cult of the Lamb save/,
  },
  {
    name: "an empty file",
    file: { name: "slot_0.mp", buffer: Buffer.alloc(0) },
    message: "The selected file is empty.",
  },
];

for (const { name, file, message } of cases) {
  test(`rejects ${name}`, async ({ page }) => {
    await page.goto("/");
    await page.setInputFiles("#file-input", {
      ...file,
      mimeType: "application/octet-stream",
    });
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(page.getByText("Choose a save")).toBeVisible();
  });
}
