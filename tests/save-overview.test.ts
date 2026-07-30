import { describe, expect, it } from "vitest";

import {
  DOCTRINE_CATEGORIES,
  ITEM_NAMES,
  RITUAL_NAMES,
} from "../src/save/catalogs";
import { buildCultOverview } from "../src/save/overview";
import type { SaveRecord } from "../src/save/types";

const overviewSave: SaveRecord = {
  BaseStructures: [{ Type: 45 }, { Type: 45 }, { Type: 10 }],
  CultName: "The Test Flock",
  CurrentDayIndex: 42,
  DoctrineUnlockedUpgrades: [10, 33, 53, 47, 999],
  Followers: [
    {
      Age: 20,
      CursedState: 0,
      ID: 1,
      Traits: [1, 2],
      XPLevel: 3,
      _happiness: 80,
      _illness: 0,
      _name: "Ada",
      _satiation: 70,
    },
    {
      Age: 31,
      CursedState: 1,
      ID: 2,
      Traits: [3],
      XPLevel: 5,
      _happiness: 55,
      _illness: 6,
      _name: "Baal",
      _satiation: 44,
    },
  ],
  Followers_Imprisoned_IDs: [2],
  UnlockedUpgrades: [111, 268, 999],
  UnlockedSermonsAndRituals: [9, 19, 999],
  items: [
    { QuantityReserved: 5, quantity: 123, type: 20 },
    { QuantityReserved: 0, quantity: 4, type: 154 },
    { QuantityReserved: 0, quantity: 2, type: 999 },
  ],
};

describe("buildCultOverview", () => {
  it("extracts identity, follower, base, and resource data", () => {
    const overview = buildCultOverview(overviewSave);

    expect(overview.identity.name).toBe("The Test Flock");
    expect(overview.identity.day).toBe(42);
    expect(overview.followerCount).toBe(2);
    expect(overview.structureCount).toBe(3);
    expect(overview.structureTypeCount).toBe(2);
    expect(overview.itemTypeCount).toBe(3);
    expect(overview.followers[1]).toMatchObject({
      age: 31,
      happiness: 55,
      id: 2,
      illness: 6,
      level: 5,
      name: "Baal",
      satiation: 44,
      statuses: ["Imprisoned", "Cursed"],
      traitCount: 1,
    });
    expect(overview.resources).toEqual([
      {
        id: 20,
        known: true,
        name: "Gold Coins",
        quantity: 123,
        reserved: 5,
      },
      {
        id: 154,
        known: true,
        name: "Sin",
        quantity: 4,
        reserved: 0,
      },
      {
        id: 999,
        known: false,
        name: "Unknown item 999",
        quantity: 2,
        reserved: 0,
      },
    ]);
  });

  it("matches doctrine choices, special grants, and rituals", () => {
    const overview = buildCultOverview(overviewSave);
    const work = overview.doctrine.categories.find(
      (category) => category.key === "work",
    );
    const afterlife = overview.doctrine.categories.find(
      (category) => category.key === "afterlife",
    );
    const sins = overview.doctrine.categories.find(
      (category) => category.key === "sins",
    );

    expect(work?.pairs[0]?.selected[0]?.name).toBe("Faithful");
    expect(afterlife?.pairs[1]?.selected[0]?.name).toBe("Funeral");
    expect(sins?.pairs[0]?.selected[0]?.name).toBe("Rite of Lust");
    expect(overview.doctrine.specials).toEqual([
      { id: 47, name: "Sacrifice of the Flesh" },
    ]);
    expect(overview.doctrine.unknownIds).toEqual([999]);
    expect(overview.rituals).toEqual([
      { id: 111, name: "Funeral" },
      { id: 268, name: "Rite of Lust" },
    ]);
    expect(overview.sermonsAndRites).toEqual([
      { id: 9, name: "Sermon of Enlightenment" },
      { id: 19, name: "Sacrifice Follower" },
      { id: 999, name: "Unknown sermon or rite 999" },
    ]);
  });

  it("reports conflicting doctrine choices", () => {
    const overview = buildCultOverview({
      DoctrineUnlockedUpgrades: [10, 11],
    });
    const work = overview.doctrine.categories.find(
      (category) => category.key === "work",
    );

    expect(work?.pairs[0]?.state).toBe("conflict");
    expect(work?.pairs[0]?.selected).toHaveLength(2);
    expect(work?.selectedCount).toBe(0);
  });
});

describe("save catalogs", () => {
  it("defines four opposed choices for every doctrine category", () => {
    const doctrineIds = DOCTRINE_CATEGORIES.flatMap((category) => {
      expect(category.pairs).toHaveLength(4);
      return category.pairs.flatMap((pair, index) => {
        expect(pair.rank).toBe(index + 1);
        expect(pair.choices.map((choice) => choice.side)).toEqual([
          "left",
          "right",
        ]);
        return pair.choices.map((choice) => choice.doctrineId);
      });
    });

    expect(DOCTRINE_CATEGORIES).toHaveLength(7);
    expect(new Set(doctrineIds).size).toBe(doctrineIds.length);
    expect(doctrineIds).toHaveLength(56);
  });

  it("includes current Woolhaven doctrines and common save values", () => {
    const woolhaven = DOCTRINE_CATEGORIES.find(
      (category) => category.key === "winter",
    );

    expect(
      woolhaven?.pairs.flatMap((pair) =>
        pair.choices.map((choice) => choice.doctrineId),
      ),
    ).toEqual([72, 73, 74, 78, 65, 64, 71, 70]);
    expect(ITEM_NAMES[154]).toBe("Sin");
    expect(RITUAL_NAMES[299]).toBe("Midwinter Ritual");
    expect(RITUAL_NAMES[337]).toBe("Remove Rot");
    expect(RITUAL_NAMES[340]).toBe("Reject the Rot");
  });
});
