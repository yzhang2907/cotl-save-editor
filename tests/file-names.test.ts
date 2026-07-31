import { describe, expect, it } from "vitest";

import { editedSaveFileName } from "../src/save/file-names";

describe("editedSaveFileName", () => {
  it.each([
    ["slot_0.mp", "slot_0.edited.mp"],
    ["slot_4.MP", "slot_4.edited.mp"],
    ["slot_0.edited.mp", "slot_0.edited.edited.mp"],
    ["copied-save", "copied-save.edited.mp"],
    [".mp", "slot.edited.mp"],
  ])("never reuses source name %s", (source, expected) => {
    const output = editedSaveFileName(source);

    expect(output).toBe(expected);
    expect(output).not.toBe(source);
  });
});
