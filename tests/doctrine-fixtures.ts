import {
  DOCTRINE_CATEGORIES,
  type DoctrineCategoryDefinition,
  type DoctrineChoiceDefinition,
  type DoctrineSide,
} from "../src/save/catalogs";
import type { SaveRecord } from "../src/save/types";
import { UNKNOWN_CATALOG_ID } from "./save-fixtures";

function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`The doctrine catalog has no ${description}.`);
  }
  return value;
}

export function doctrineCategory(
  key: DoctrineCategoryDefinition["key"],
): DoctrineCategoryDefinition {
  return required(
    DOCTRINE_CATEGORIES.find((category) => category.key === key),
    `${key} category`,
  );
}

export function doctrineChoice(
  categoryKey: DoctrineCategoryDefinition["key"],
  rank: number,
  side: DoctrineSide,
): DoctrineChoiceDefinition {
  const category = doctrineCategory(categoryKey);
  const pair = required(
    category.pairs.find((candidate) => candidate.rank === rank),
    `${category.name} rank ${rank}`,
  );
  return required(
    pair.choices.find((candidate) => candidate.side === side),
    `${category.name} rank ${rank} ${side} choice`,
  );
}

export function doctrineSaveFromChoices(
  choices: DoctrineChoiceDefinition[],
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return {
    CultTraits: choices.flatMap((choice) => choice.cultTraitIds),
    DoctrineUnlockedUpgrades: choices.map(
      (choice) => choice.doctrineId,
    ),
    UnlockedUpgrades: choices.flatMap((choice) => choice.upgradeIds),
    ...overrides,
  };
}

export const WORK_CATEGORY = doctrineCategory("work");
export const WORK_SELECTED_CHOICES = WORK_CATEGORY.pairs.map(
  (pair) => pair.choices[0],
);
export const WORK_FIRST_PAIR = required(
  WORK_CATEGORY.pairs[0],
  `${WORK_CATEGORY.name} first pair`,
);
export const WORK_HIGHEST_PAIR = required(
  WORK_CATEGORY.pairs.at(-1),
  `${WORK_CATEGORY.name} highest pair`,
);
export const WORK_HIGHEST_CHOICE = WORK_HIGHEST_PAIR.choices[0];
export const WORK_PREVIOUS_PAIR = required(
  WORK_CATEGORY.pairs.at(-2),
  `${WORK_CATEGORY.name} previous pair`,
);
export const WORK_PREVIOUS_CHOICE = WORK_PREVIOUS_PAIR.choices[0];

export function completedWorkDoctrineSave(
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return doctrineSaveFromChoices(WORK_SELECTED_CHOICES, overrides);
}

export const FAITHFUL = doctrineChoice("work", 1, "left");
export const INDUSTRIOUS = doctrineChoice("work", 1, "right");
export const INSPIRE = doctrineChoice("work", 2, "left");
export const GLORY_OF_CONSTRUCTION = doctrineChoice("work", 3, "left");
export const HOLY_DAY_RITUAL = doctrineChoice("work", 4, "right");
export const BELIEF_IN_AFTERLIFE = doctrineChoice(
  "afterlife",
  1,
  "right",
);
export const BELIEF_IN_SACRIFICE = doctrineChoice(
  "afterlife",
  1,
  "left",
);
export const RITUAL_OF_RESURRECTION = doctrineChoice(
  "afterlife",
  2,
  "left",
);
export const FUNERAL = doctrineChoice("afterlife", 2, "right");
export const FEASTING_RITUAL = doctrineChoice(
  "sustenance",
  1,
  "right",
);
export const RITUAL_FAST = doctrineChoice("sustenance", 1, "left");
export const MURDER_FOLLOWER = doctrineChoice("law", 1, "left");
export const ASCEND_FOLLOWER = doctrineChoice("law", 1, "right");
export const FURNACE_FOLLOWERS = doctrineChoice(
  "winter",
  1,
  "left",
);
export const RITE_OF_LUST = doctrineChoice("sins", 1, "left");

export const PRESERVED_SPECIAL_DOCTRINE_ID = 47;
export const PRESERVED_TRAIT_ID = 99;
export const PRESERVED_UPGRADE_ID = 60;
export const STANDARD_DOCTRINE_IDS = [
  FAITHFUL.doctrineId,
  FUNERAL.doctrineId,
  PRESERVED_SPECIAL_DOCTRINE_ID,
];
export const STANDARD_TRAIT_IDS = [
  ...FAITHFUL.cultTraitIds,
  ...BELIEF_IN_AFTERLIFE.cultTraitIds,
  PRESERVED_TRAIT_ID,
];
export const STANDARD_UPGRADE_IDS = [
  ...FUNERAL.upgradeIds,
  PRESERVED_UPGRADE_ID,
  UNKNOWN_CATALOG_ID,
];

export function standardDoctrineSave(
  overrides: Partial<SaveRecord> = {},
): SaveRecord {
  return doctrineSaveFromChoices([FAITHFUL, FUNERAL], {
    CultTraits: STANDARD_TRAIT_IDS.slice(),
    DoctrineUnlockedUpgrades: STANDARD_DOCTRINE_IDS.slice(),
    UnlockedUpgrades: STANDARD_UPGRADE_IDS.slice(),
    ...overrides,
  });
}
