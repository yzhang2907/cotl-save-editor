import { describe, expect, it } from "vitest";

import {
  DOCTRINE_CATEGORIES,
  ITEM_NAMES,
  RITUAL_NAMES,
} from "../src/save/catalogs";
import { buildCultOverview } from "../src/save/overview";
import resourceIconDefinitions from "../src/save/resource-icons.json";
import type { SaveRecord } from "../src/save/types";
import {
  FAITHFUL,
  FUNERAL,
  INDUSTRIOUS,
  PRESERVED_SPECIAL_DOCTRINE_ID,
  RITE_OF_LUST,
} from "./doctrine-fixtures";
import {
  TEST_CULT_NAME,
  UNKNOWN_CATALOG_ID,
} from "./save-fixtures";

const CURRENT_DAY = 42;
const STRUCTURE_TYPES = {
  FARM: 45,
  TEMPLE: 10,
} as const;
const FOLLOWERS = {
  ADA: {
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
  BAAL: {
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
} as const;
const ITEMS = {
  GOLD: { QuantityReserved: 5, quantity: 123, type: 20 },
  SIN: { QuantityReserved: 0, quantity: 4, type: 154 },
  UNKNOWN: {
    QuantityReserved: 0,
    quantity: 2,
    type: UNKNOWN_CATALOG_ID,
  },
} as const;
const SERMON_IDS = {
  ENLIGHTENMENT: 9,
  SACRIFICE_FOLLOWER: 19,
} as const;
const EXPECTED_RESOURCE_ICONS = [
  [1, "Wood"],
  [2, "Stone"],
  [6, "Food"],
  [9, "VileBones"],
  [20, "GoldCoin"],
  [29, "Mushroom"],
  [55, "Flower_Red"],
  [62, "MeatLarge"],
  [83, "GoldNugget"],
  [122, "Necklace_9"],
  [124, "Necklace_11"],
  [125, "Necklace_10"],
  [126, "Necklace_8"],
  [127, "Necklace_6"],
  [133, "Cotton"],
] as const;
const DOCTRINE_PAIRS_PER_CATEGORY = 4;
const DOCTRINE_CHOICES_PER_PAIR = 2;
const EXPECTED_DOCTRINE_CATEGORY_COUNT = 7;
const EXPECTED_WOOLHAVEN_DOCTRINE_IDS = [
  72, 73, 74, 78, 65, 64, 71, 70,
] as const;
const CATALOG_IDS = {
  MIDWINTER_RITUAL: 299,
  REJECT_ROT_RITUAL: 340,
  REMOVE_ROT_RITUAL: 337,
  SIN_ITEM: ITEMS.SIN.type,
} as const;
const BASE_STRUCTURES = [
  { Type: STRUCTURE_TYPES.FARM },
  { Type: STRUCTURE_TYPES.FARM },
  { Type: STRUCTURE_TYPES.TEMPLE },
];
const FOLLOWER_LIST = [FOLLOWERS.ADA, FOLLOWERS.BAAL];
const ITEM_LIST = [ITEMS.GOLD, ITEMS.SIN, ITEMS.UNKNOWN];

const overviewSave: SaveRecord = {
  BaseStructures: BASE_STRUCTURES,
  CultName: TEST_CULT_NAME,
  CurrentDayIndex: CURRENT_DAY,
  DoctrineUnlockedUpgrades: [
    FAITHFUL.doctrineId,
    FUNERAL.doctrineId,
    RITE_OF_LUST.doctrineId,
    PRESERVED_SPECIAL_DOCTRINE_ID,
    UNKNOWN_CATALOG_ID,
  ],
  Followers: FOLLOWER_LIST,
  Followers_Imprisoned_IDs: [FOLLOWERS.BAAL.ID],
  UnlockedUpgrades: [
    ...FUNERAL.upgradeIds,
    ...RITE_OF_LUST.upgradeIds,
    UNKNOWN_CATALOG_ID,
  ],
  UnlockedSermonsAndRituals: [
    SERMON_IDS.ENLIGHTENMENT,
    SERMON_IDS.SACRIFICE_FOLLOWER,
    UNKNOWN_CATALOG_ID,
  ],
  items: ITEM_LIST,
};

describe("buildCultOverview", () => {
  it("builds full follower detail and dead followers", () => {
    const overview = buildCultOverview({
      Followers: [
        {
          Clothing: 23,
          Faction: 3,
          FollowerRole: 3,
          Hat: 0,
          ID: 7,
          Necklace: 47,
          Outfit: 7,
          ShowingNecklace: false,
          SkinColour: 17,
          SkinName: "Seahorse3",
          SkinVariation: 2,
          SpouseFollowerID: 9,
          Traits: [6],
          _name: "Webb",
        },
      ],
      Followers_Dead: [
        {
          DiedOfOldAge: true,
          HadFuneral: true,
          HasBeenBuried: true,
          ID: 9,
          MurderedBy: 7,
          _name: "Mola",
        },
      ],
    });

    expect(overview.followers[0]).toMatchObject({
      appearance: {
        colour: 17,
        hat: null,
        necklace: "Skull Necklace",
        necklaceHidden: true,
        skinName: "Seahorse",
        skinVariation: 2,
      },
      death: null,
      role: "Farmer",
      spouse: "Mola",
      traits: ["Grass Eater"],
    });
    expect(overview.followers[0]?.appearance.outfit).not.toBeNull();
    expect(overview.deadFollowers[0]).toMatchObject({
      death: {
        buried: true,
        cause: "Old age",
        funeral: true,
        murderedBy: "Webb",
      },
      name: "Mola",
      statuses: [],
    });
  });

  it("extracts identity, follower, base, and resource data", () => {
    const overview = buildCultOverview(overviewSave);

    expect(overview.identity.name).toBe(TEST_CULT_NAME);
    expect(overview.identity.day).toBe(CURRENT_DAY);
    expect(overview.followerCount).toBe(FOLLOWER_LIST.length);
    expect(overview.structureCount).toBe(BASE_STRUCTURES.length);
    expect(overview.structureTypeCount).toBe(
      new Set(BASE_STRUCTURES.map((structure) => structure.Type)).size,
    );
    expect(overview.itemTypeCount).toBe(ITEM_LIST.length);
    expect(overview.followers[1]).toMatchObject({
      age: FOLLOWERS.BAAL.Age,
      happiness: FOLLOWERS.BAAL._happiness,
      id: FOLLOWERS.BAAL.ID,
      illness: FOLLOWERS.BAAL._illness,
      level: FOLLOWERS.BAAL.XPLevel,
      name: FOLLOWERS.BAAL._name,
      satiation: FOLLOWERS.BAAL._satiation,
      statuses: ["Imprisoned"],
      traits: ["Belief in Afterlife"],
    });
    expect(overview.resources).toEqual([
      {
        id: ITEMS.GOLD.type,
        known: true,
        name: "Gold Coins",
        quantity: ITEMS.GOLD.quantity,
        reserved: ITEMS.GOLD.QuantityReserved,
        reservedStored: true,
      },
      {
        id: ITEMS.SIN.type,
        known: true,
        name: "Sin",
        quantity: ITEMS.SIN.quantity,
        reserved: ITEMS.SIN.QuantityReserved,
        reservedStored: true,
      },
      {
        id: ITEMS.UNKNOWN.type,
        known: false,
        name: `Unknown item ${UNKNOWN_CATALOG_ID}`,
        quantity: ITEMS.UNKNOWN.quantity,
        reserved: ITEMS.UNKNOWN.QuantityReserved,
        reservedStored: true,
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

    expect(work?.pairs[0]?.selected[0]?.name).toBe(FAITHFUL.name);
    expect(afterlife?.pairs[1]?.selected[0]?.name).toBe(FUNERAL.name);
    expect(sins?.pairs[0]?.selected[0]?.name).toBe(RITE_OF_LUST.name);
    expect(overview.doctrine.specials).toEqual([
      { id: PRESERVED_SPECIAL_DOCTRINE_ID, name: "Sacrifice of the Flesh" },
    ]);
    expect(overview.doctrine.unknownIds).toEqual([UNKNOWN_CATALOG_ID]);
    expect(overview.rituals).toEqual([
      { id: FUNERAL.upgradeIds[0], name: FUNERAL.name },
      { id: RITE_OF_LUST.upgradeIds[0], name: RITE_OF_LUST.name },
    ]);
    expect(overview.sermonsAndRites).toEqual([
      { id: SERMON_IDS.ENLIGHTENMENT, name: "Sermon of Enlightenment" },
      {
        id: SERMON_IDS.SACRIFICE_FOLLOWER,
        name: "Sacrifice Follower",
      },
      {
        id: UNKNOWN_CATALOG_ID,
        name: `Unknown sermon or rite ${UNKNOWN_CATALOG_ID}`,
      },
    ]);
  });

  it("reports both postgame doctrine choices as complete", () => {
    const overview = buildCultOverview({
      DoctrineUnlockedUpgrades: [
        FAITHFUL.doctrineId,
        INDUSTRIOUS.doctrineId,
      ],
    });
    const work = overview.doctrine.categories.find(
      (category) => category.key === "work",
    );

    expect(work?.pairs[0]?.state).toBe("complete");
    expect(work?.pairs[0]?.selected).toHaveLength(
      DOCTRINE_CHOICES_PER_PAIR,
    );
    expect(work?.selectedCount).toBe(DOCTRINE_CHOICES_PER_PAIR);
  });
});

describe("save catalogs", () => {
  it("uses explicit item IDs for resource icons", () => {
    const iconsById = new Map(
      resourceIconDefinitions.map((definition) => [
        definition.id,
        definition.sprite,
      ]),
    );

    expect(new Set(iconsById.keys()).size).toBe(
      resourceIconDefinitions.length,
    );
    for (const [id, sprite] of EXPECTED_RESOURCE_ICONS) {
      expect(iconsById.get(id)).toBe(sprite);
    }
  });

  it("defines four opposed choices for every doctrine category", () => {
    const doctrineIds = DOCTRINE_CATEGORIES.flatMap((category) => {
      expect(category.pairs).toHaveLength(DOCTRINE_PAIRS_PER_CATEGORY);
      return category.pairs.flatMap((pair, index) => {
        expect(pair.rank).toBe(index + 1);
        expect(pair.choices.map((choice) => choice.side)).toEqual([
          "left",
          "right",
        ]);
        return pair.choices.map((choice) => choice.doctrineId);
      });
    });

    expect(DOCTRINE_CATEGORIES).toHaveLength(
      EXPECTED_DOCTRINE_CATEGORY_COUNT,
    );
    expect(new Set(doctrineIds).size).toBe(doctrineIds.length);
    expect(doctrineIds).toHaveLength(
      EXPECTED_DOCTRINE_CATEGORY_COUNT *
        DOCTRINE_PAIRS_PER_CATEGORY *
        DOCTRINE_CHOICES_PER_PAIR,
    );
  });

  it("includes current Woolhaven doctrines and common save values", () => {
    const woolhaven = DOCTRINE_CATEGORIES.find(
      (category) => category.key === "winter",
    );

    expect(
      woolhaven?.pairs.flatMap((pair) =>
        pair.choices.map((choice) => choice.doctrineId),
      ),
    ).toEqual(EXPECTED_WOOLHAVEN_DOCTRINE_IDS);
    expect(ITEM_NAMES[CATALOG_IDS.SIN_ITEM]).toBe("Sin");
    expect(RITUAL_NAMES[CATALOG_IDS.MIDWINTER_RITUAL]).toBe(
      "Midwinter Ritual",
    );
    expect(RITUAL_NAMES[CATALOG_IDS.REMOVE_ROT_RITUAL]).toBe("Remove Rot");
    expect(RITUAL_NAMES[CATALOG_IDS.REJECT_ROT_RITUAL]).toBe(
      "Reject the Rot",
    );
  });
});
