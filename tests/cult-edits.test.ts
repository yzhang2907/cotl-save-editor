import { describe, expect, it } from "vitest";

import {
  applyCultEdits,
  CultEditError,
  discardCultNameEdit,
  discardResourceEdit,
  emptyCultEdits,
  hasCultEdits,
  listPendingCultEdits,
  MAX_CULT_NAME_LENGTH,
  MAX_RESOURCE_QUANTITY,
  stageCultNameEdit,
  stageResourceAddition,
  stageResourceEdit,
} from "../src/save/cult-edits";
import type { SaveRecord } from "../src/save/types";
import { TEST_CULT_NAME } from "./save-fixtures";

const GOLD = { QuantityReserved: 5, quantity: 123, type: 20 };
const SIN = { QuantityReserved: 0, quantity: 4, type: 154 };
const LEGACY_ITEM = { quantity: 9, type: 33 };

function originalSave(): SaveRecord {
  return {
    CultName: TEST_CULT_NAME,
    CurrentDayIndex: 12,
    items: [
      { ...GOLD },
      { ...SIN },
      { ...LEGACY_ITEM },
    ],
  };
}

describe("cult name staging", () => {
  it("stages a trimmed rename and lists it as pending", () => {
    const original = originalSave();
    const edits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "  Chosen of the Isopod  ",
    );

    expect(edits.cultName).toBe("Chosen of the Isopod");
    expect(hasCultEdits(edits)).toBe(true);
    expect(listPendingCultEdits(original, edits)).toEqual([
      {
        from: TEST_CULT_NAME,
        kind: "cult-name",
        to: "Chosen of the Isopod",
      },
    ]);
  });

  it("drops the staged rename when the original name returns", () => {
    const original = originalSave();
    let edits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "Chosen of the Isopod",
    );
    edits = stageCultNameEdit(original, edits, TEST_CULT_NAME);

    expect(edits.cultName).toBeNull();
    expect(hasCultEdits(edits)).toBe(false);
  });

  it("rejects empty, oversized, and control-character names", () => {
    const original = originalSave();

    expect(() =>
      stageCultNameEdit(original, emptyCultEdits(), "   "),
    ).toThrow("cannot be empty");
    expect(() =>
      stageCultNameEdit(
        original,
        emptyCultEdits(),
        "n".repeat(MAX_CULT_NAME_LENGTH + 1),
      ),
    ).toThrow(`${MAX_CULT_NAME_LENGTH} characters`);
    expect(() =>
      stageCultNameEdit(original, emptyCultEdits(), "bad\u0000name"),
    ).toThrow("control characters");
  });

  it("refuses to stage a rename without a stored cult name", () => {
    expect(() =>
      stageCultNameEdit({ items: [] }, emptyCultEdits(), "New Name"),
    ).toThrow(CultEditError);
  });
});

describe("resource staging", () => {
  it("stages quantity and reserved changes for an existing item", () => {
    const original = originalSave();
    const edits = stageResourceEdit(original, emptyCultEdits(), {
      quantity: 400,
      reserved: 2,
      type: GOLD.type,
    });

    expect(edits.resources).toEqual([
      { quantity: 400, reserved: 2, type: GOLD.type },
    ]);
    expect(listPendingCultEdits(original, edits)).toEqual([
      {
        itemName: "Gold Coins",
        itemType: GOLD.type,
        kind: "resource",
        quantityFrom: GOLD.quantity,
        quantityTo: 400,
        reservedFrom: GOLD.QuantityReserved,
        reservedTo: 2,
      },
    ]);
  });

  it("drops a staged edit that matches the original values", () => {
    const original = originalSave();
    let edits = stageResourceEdit(original, emptyCultEdits(), {
      quantity: 400,
      reserved: GOLD.QuantityReserved,
      type: GOLD.type,
    });
    edits = stageResourceEdit(original, edits, {
      quantity: GOLD.quantity,
      reserved: GOLD.QuantityReserved,
      type: GOLD.type,
    });

    expect(edits.resources).toEqual([]);
  });

  it("rejects unknown items, bad ranges, and over-reservation", () => {
    const original = originalSave();

    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: 5,
        reserved: 0,
        type: 999,
      }),
    ).toThrow("not in this save's inventory");
    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: -1,
        reserved: 0,
        type: GOLD.type,
      }),
    ).toThrow("whole number");
    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: MAX_RESOURCE_QUANTITY + 1,
        reserved: 0,
        type: GOLD.type,
      }),
    ).toThrow("whole number");
    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: 3.5,
        reserved: 0,
        type: GOLD.type,
      }),
    ).toThrow("whole number");
    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: 10,
        reserved: 11,
        type: GOLD.type,
      }),
    ).toThrow("cannot be larger than the item quantity");
  });

  it("keeps a missing reserved quantity at zero", () => {
    const original = originalSave();

    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: 20,
        reserved: 1,
        type: LEGACY_ITEM.type,
      }),
    ).toThrow("must stay 0");

    const edits = stageResourceEdit(original, emptyCultEdits(), {
      quantity: 20,
      reserved: 0,
      type: LEGACY_ITEM.type,
    });
    const applied = applyCultEdits(original, original, edits);

    expect(applied.items).toEqual([
      GOLD,
      SIN,
      { quantity: 20, type: LEGACY_ITEM.type },
    ]);
  });

  it("rejects an inventory with a duplicated item type", () => {
    const original = {
      ...originalSave(),
      items: [{ ...GOLD }, { ...GOLD }],
    };

    expect(() =>
      stageResourceEdit(original, emptyCultEdits(), {
        quantity: 1,
        reserved: 0,
        type: GOLD.type,
      }),
    ).toThrow("appears more than once");
  });
});

describe("resource additions", () => {
  it("stages, lists, and applies an added catalog item", () => {
    const original = originalSave();
    const edits = stageResourceAddition(original, emptyCultEdits(), {
      quantity: 250,
      reserved: 0,
      type: 2,
    });

    expect(hasCultEdits(edits)).toBe(true);
    expect(listPendingCultEdits(original, edits)).toEqual([
      {
        itemName: "Stone",
        itemType: 2,
        kind: "resource-add",
        quantity: 250,
        requiredDlc: null,
        reserved: 0,
      },
    ]);
    expect(applyCultEdits(original, original, edits).items).toEqual([
      GOLD,
      SIN,
      LEGACY_ITEM,
      { type: 2, quantity: 250, QuantityReserved: 0 },
    ]);
  });

  it("rejects unknown catalog items and already-present items", () => {
    const original = originalSave();

    expect(() =>
      stageResourceAddition(original, emptyCultEdits(), {
        quantity: 1,
        reserved: 0,
        type: 9999,
      }),
    ).toThrow("not in the known item catalog");
    expect(() =>
      stageResourceAddition(original, emptyCultEdits(), {
        quantity: 1,
        reserved: 0,
        type: GOLD.type,
      }),
    ).toThrow("already in the inventory");
  });

  it("gates Woolhaven-only items on the save's DLC activation", () => {
    const original = originalSave();

    expect(() =>
      stageResourceAddition(original, emptyCultEdits(), {
        quantity: 1,
        reserved: 0,
        type: 185,
      }),
    ).toThrow("requires this save to have Woolhaven activated");

    const dlcSave = { ...originalSave(), MAJOR_DLC: true };
    const edits = stageResourceAddition(dlcSave, emptyCultEdits(), {
      quantity: 1,
      reserved: 0,
      type: 185,
    });
    expect(listPendingCultEdits(dlcSave, edits)).toEqual([
      {
        itemName: "Woolhaven Necklace",
        itemType: 185,
        kind: "resource-add",
        quantity: 1,
        requiredDlc: "woolhaven",
        reserved: 0,
      },
    ]);
  });

  it("updates a staged addition through the ordinary edit path", () => {
    const original = originalSave();
    let edits = stageResourceAddition(original, emptyCultEdits(), {
      quantity: 250,
      reserved: 0,
      type: 2,
    });
    edits = stageResourceEdit(original, edits, {
      quantity: 400,
      reserved: 0,
      type: 2,
    });

    expect(edits.additions).toEqual([
      { quantity: 400, reserved: 0, type: 2 },
    ]);
    expect(edits.resources).toEqual([]);
  });

  it("discards an addition through the shared discard path", () => {
    const original = originalSave();
    const edits = stageResourceAddition(original, emptyCultEdits(), {
      quantity: 250,
      reserved: 0,
      type: 2,
    });

    expect(hasCultEdits(discardResourceEdit(edits, 2))).toBe(false);
  });
});

describe("applyCultEdits", () => {
  it("applies staged edits without touching other fields", () => {
    const original = originalSave();
    let edits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "Chosen of the Isopod",
    );
    edits = stageResourceEdit(original, edits, {
      quantity: 400,
      reserved: 2,
      type: GOLD.type,
    });

    const working = applyCultEdits(original, original, edits);

    expect(working).not.toBe(original);
    expect(working.CultName).toBe("Chosen of the Isopod");
    expect(working.items).toEqual([
      { QuantityReserved: 2, quantity: 400, type: GOLD.type },
      SIN,
      LEGACY_ITEM,
    ]);
    expect(working.CurrentDayIndex).toBe(original.CurrentDayIndex);
    expect(original.CultName).toBe(TEST_CULT_NAME);
    expect((original.items as SaveRecord[])[0]).toEqual(GOLD);
    expect(
      (working.items as SaveRecord[])[1],
    ).toBe((original.items as SaveRecord[])[1]);
  });

  it("returns the same record when nothing is staged", () => {
    const original = originalSave();

    expect(applyCultEdits(original, original, emptyCultEdits())).toBe(
      original,
    );
  });

  it("stops when the working data drifted from the original", () => {
    const original = originalSave();
    const edits = stageResourceEdit(original, emptyCultEdits(), {
      quantity: 400,
      reserved: 2,
      type: GOLD.type,
    });
    const drifted = {
      ...original,
      items: [{ ...SIN }],
    };

    expect(() => applyCultEdits(drifted, original, edits)).toThrow(
      "inventory changed before the staged edits were applied",
    );
  });

  it("stops when a staged rename no longer matches the working name", () => {
    const original = originalSave();
    const edits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "Chosen of the Isopod",
    );
    const drifted = { ...original, CultName: "Drifted" };

    expect(() => applyCultEdits(drifted, original, edits)).toThrow(
      "cult name changed before the staged edit was applied",
    );
  });
});

describe("discarding cult edits", () => {
  it("discards the rename and single resource edits independently", () => {
    const original = originalSave();
    let edits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "Chosen of the Isopod",
    );
    edits = stageResourceEdit(original, edits, {
      quantity: 400,
      reserved: 2,
      type: GOLD.type,
    });
    edits = stageResourceEdit(original, edits, {
      quantity: 8,
      reserved: 0,
      type: SIN.type,
    });

    edits = discardResourceEdit(edits, GOLD.type);
    expect(edits.resources).toEqual([
      { quantity: 8, reserved: 0, type: SIN.type },
    ]);
    expect(edits.cultName).toBe("Chosen of the Isopod");

    edits = discardCultNameEdit(edits);
    expect(edits.cultName).toBeNull();
    expect(hasCultEdits(edits)).toBe(true);

    edits = discardResourceEdit(edits, SIN.type);
    expect(hasCultEdits(edits)).toBe(false);
  });
});
