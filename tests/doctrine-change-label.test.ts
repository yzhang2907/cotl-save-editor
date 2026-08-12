import { describe, expect, it } from "vitest";

import type { PendingDoctrineChange } from "../src/save/doctrine-workspace";
import { doctrineChangeLabel } from "../src/ui/doctrine-change-label";

function change(
  overrides: Partial<PendingDoctrineChange>,
): PendingDoctrineChange {
  return {
    categoryName: "Work & Worship",
    fromDoctrineId: 1,
    fromName: "Faithful",
    operation: "replace",
    rank: 1,
    requiredDlc: null,
    toDoctrineId: 2,
    toName: "Industrious",
    ...overrides,
  };
}

describe("doctrineChangeLabel", () => {
  it("labels an unlock without a source choice", () => {
    expect(
      doctrineChangeLabel(
        change({ fromDoctrineId: null, fromName: null, operation: "unlock" }),
      ),
    ).toBe("Unlock Industrious");
  });

  it("labels a removal without a target choice", () => {
    expect(
      doctrineChangeLabel(
        change({ operation: "remove", toDoctrineId: null, toName: null }),
      ),
    ).toBe("Remove Faithful");
  });

  it("labels a replacement with both names", () => {
    expect(doctrineChangeLabel(change({}))).toBe("Faithful → Industrious");
  });
});
