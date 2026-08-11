import {
  CATALOG_GAME_VERSION,
  DOCTRINE_CATEGORIES,
  ITEM_NAMES,
  RITUAL_NAMES,
  SERMON_AND_RITE_NAMES,
  SPECIAL_DOCTRINE_NAMES,
  type DoctrineChoiceDefinition,
} from "./catalogs";
import {
  catalogName,
  FOLLOWER_CLOTHING,
  FOLLOWER_FACTIONS,
  FOLLOWER_HATS,
  FOLLOWER_OUTFITS,
  FOLLOWER_ROLES,
  FOLLOWER_THOUGHTS,
  FOLLOWER_TRAITS,
  type FollowerCatalog,
} from "./follower-catalogs";
import type { SaveRecord } from "./types";

export interface CultIdentityOverview {
  cultLevel: number | null;
  day: number | null;
  difficultyCode: number | null;
  name: string | null;
  playTimeSeconds: number | null;
}

export interface FollowerAppearance {
  clothing: string | null;
  colour: number | null;
  hat: string | null;
  necklace: string | null;
  necklaceHidden: boolean;
  outfit: string | null;
  skinName: string | null;
  skinVariation: number | null;
}

export interface FollowerDeath {
  buried: boolean;
  cause: string | null;
  causeFlag: string | null;
  day: number | null;
  funeral: boolean;
  murderedBy: string | null;
}

export interface FollowerOverview {
  adoration: number | null;
  age: number | null;
  appearance: FollowerAppearance;
  bornInCult: boolean;
  dayJoined: number | null;
  death: FollowerDeath | null;
  elder: boolean;
  faction: string | null;
  faith: number | null;
  happiness: number | null;
  id: number | null;
  illness: number | null;
  level: number | null;
  lifeExpectancy: number | null;
  name: string;
  parents: string[];
  role: string | null;
  satiation: number | null;
  spouse: string | null;
  stateThought: string | null;
  statuses: string[];
  traitIds: number[];
  traits: string[];
}

export interface ResourceOverview {
  id: number;
  known: boolean;
  name: string;
  quantity: number;
  reserved: number;
  reservedStored: boolean;
}

export interface DoctrinePairOverview {
  choices: [DoctrineChoiceDefinition, DoctrineChoiceDefinition];
  rank: number;
  selected: DoctrineChoiceDefinition[];
  state: "complete" | "missing" | "selected";
}

export interface DoctrineCategoryOverview {
  key: string;
  name: string;
  pairs: DoctrinePairOverview[];
  selectedCount: number;
}

export interface NamedId {
  id: number;
  name: string;
}

export interface DoctrineOverview {
  catalogVersion: string;
  categories: DoctrineCategoryOverview[];
  selectedChoiceCount: number;
  specials: NamedId[];
  unknownIds: number[];
}

export interface CultOverview {
  deadFollowers: FollowerOverview[];
  doctrine: DoctrineOverview;
  followerCount: number | null;
  followers: FollowerOverview[];
  identity: CultIdentityOverview;
  itemTypeCount: number | null;
  resources: ResourceOverview[];
  rituals: NamedId[];
  sermonsAndRites: NamedId[];
  structureCount: number | null;
  structureTypeCount: number | null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integer(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function recordValue(value: unknown): SaveRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as SaveRecord)
    : null;
}

function recordArray(value: unknown): SaveRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const record = recordValue(entry);
    return record === null ? [] : [record];
  });
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const parsed = integer(entry);
    return parsed === null ? [] : [parsed];
  });
}

function idSet(data: SaveRecord, key: string): Set<number> {
  return new Set(numberArray(data[key]));
}

function followerStatuses(
  follower: SaveRecord,
  statusIds: Readonly<Record<string, Set<number>>>,
): string[] {
  const id = integer(follower.ID);
  const statuses: string[] = [];

  if (id !== null) {
    for (const [status, ids] of Object.entries(statusIds)) {
      if (ids.has(id)) {
        statuses.push(status);
      }
    }
  }
  if (follower.LeavingCult === true) {
    statuses.push("Leaving");
  }

  return statuses.length > 0 ? statuses : ["Active"];
}

// Flag fields on dead follower records, checked in save order.
export const DEATH_CAUSES: ReadonlyArray<[string, string]> = [
  ["DiedOfIllness", "Illness"],
  ["DiedOfInjury", "Injury"],
  ["DiedOfOldAge", "Old age"],
  ["DiedOfStarvation", "Starvation"],
  ["FrozeToDeath", "Froze to death"],
  ["DiedFromRot", "Rot"],
  ["DiedFromTwitchChat", "Twitch chat"],
  ["DiedInPrison", "Died in prison"],
  ["DiedFromMurder", "Murdered"],
  ["DiedFromDeadlyDish", "Deadly dish"],
  ["DiedFromMissionary", "Lost on mission"],
  ["DiedFromLightning", "Lightning"],
  ["DiedFromOverheating", "Overheating"],
  ["BurntToDeath", "Burnt to death"],
];

function positiveInteger(value: unknown): number | null {
  const parsed = integer(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function wornName(
  value: unknown,
  catalog: FollowerCatalog,
  kind: string,
): string | null {
  // Zero is the "nothing worn" sentinel in every clothing category;
  // other "None"-keyed entries (outfit 18, Acolyte Robes) are real.
  const id = positiveInteger(value);
  return id === null ? null : catalogName(catalog, id, kind);
}

function buildAppearance(follower: SaveRecord): FollowerAppearance {
  const necklace = positiveInteger(follower.Necklace);
  return {
    clothing: wornName(follower.Clothing, FOLLOWER_CLOTHING, "clothing"),
    colour: integer(follower.SkinColour),
    hat: wornName(follower.Hat, FOLLOWER_HATS, "hat"),
    necklace:
      necklace === null
        ? null
        : (ITEM_NAMES[necklace] ?? `Unknown item ${necklace}`),
    necklaceHidden: necklace !== null && follower.ShowingNecklace === false,
    outfit: wornName(follower.Outfit, FOLLOWER_OUTFITS, "outfit"),
    skinName: stringValue(follower.SkinName)?.replace(/\d+$/, "") ?? null,
    skinVariation: integer(follower.SkinVariation),
  };
}

function buildDeath(
  follower: SaveRecord,
  followerNames: ReadonlyMap<number, string>,
): FollowerDeath {
  const murderer = positiveInteger(follower.MurderedBy);
  const cause = DEATH_CAUSES.find(([flag]) => follower[flag] === true);
  return {
    buried: follower.HasBeenBuried === true,
    cause: cause?.[1] ?? null,
    causeFlag: cause?.[0] ?? null,
    // Ritual deaths leave TimeOfDeath at zero, so zero means unrecorded.
    day: positiveInteger(follower.TimeOfDeath),
    funeral: follower.HadFuneral === true,
    murderedBy:
      murderer === null
        ? null
        : (followerNames.get(murderer) ?? `Follower ${murderer}`),
  };
}

function buildFollower(
  follower: SaveRecord,
  index: number,
  statusIds: Readonly<Record<string, Set<number>>>,
  followerNames: ReadonlyMap<number, string>,
  dead: boolean,
): FollowerOverview {
  const spouse = positiveInteger(follower.SpouseFollowerID);
  const stateThought = positiveInteger(follower.CursedState);
  return {
    adoration: finiteNumber(follower.Adoration),
    age: integer(follower.Age),
    appearance: buildAppearance(follower),
    bornInCult: follower.BornInCult === true,
    dayJoined: integer(follower.DayJoined),
    death: dead ? buildDeath(follower, followerNames) : null,
    // The game leaves dead followers' elder membership in place, so this
    // is meaningful for both lists.
    elder: (() => {
      const id = integer(follower.ID);
      return id !== null && statusIds.Elder !== undefined
        ? statusIds.Elder.has(id)
        : false;
    })(),
    faction: catalogNullable(follower.Faction, FOLLOWER_FACTIONS, "faction"),
    faith: finiteNumber(follower._faith),
    happiness: finiteNumber(follower._happiness),
    id: integer(follower.ID),
    illness: finiteNumber(follower._illness),
    level: integer(follower.XPLevel),
    lifeExpectancy: integer(follower.LifeExpectancy),
    name:
      stringValue(follower._name) ??
      stringValue(follower.Name) ??
      `Follower ${index + 1}`,
    parents: [follower.Parent1Name, follower.Parent2Name].flatMap((name) => {
      const parsed = stringValue(name);
      return parsed === null ? [] : [parsed];
    }),
    role: catalogNullable(follower.FollowerRole, FOLLOWER_ROLES, "role"),
    satiation: finiteNumber(follower._satiation),
    spouse:
      spouse === null
        ? null
        : (followerNames.get(spouse) ?? `Follower ${spouse}`),
    stateThought:
      stateThought === null
        ? null
        : catalogName(FOLLOWER_THOUGHTS, stateThought, "thought"),
    statuses: dead ? [] : followerStatuses(follower, statusIds),
    traitIds: numberArray(follower.Traits),
    traits: numberArray(follower.Traits).map((trait) =>
      catalogName(FOLLOWER_TRAITS, trait, "trait"),
    ),
  };
}

function catalogNullable(
  value: unknown,
  catalog: FollowerCatalog,
  kind: string,
): string | null {
  const id = integer(value);
  return id === null ? null : catalogName(catalog, id, kind);
}

function followerNameIndex(
  followerLists: ReadonlyArray<SaveRecord[]>,
): Map<number, string> {
  const names = new Map<number, string>();
  for (const followers of followerLists) {
    for (const follower of followers) {
      const id = integer(follower.ID);
      const name = stringValue(follower._name) ?? stringValue(follower.Name);
      if (id !== null && name !== null && !names.has(id)) {
        names.set(id, name);
      }
    }
  }
  return names;
}

function buildFollowers(data: SaveRecord): {
  deadFollowers: FollowerOverview[];
  followers: FollowerOverview[];
} {
  const statusIds: Readonly<Record<string, Set<number>>> = {
    Elder: idSet(data, "Followers_Elderly_IDs"),
    Imprisoned: idSet(data, "Followers_Imprisoned_IDs"),
    Missionary: idSet(data, "Followers_OnMissionary_IDs"),
    Possessed: new Set(
      recordArray(data.Followers_Possessed).flatMap((entry) => {
        const id = integer(entry.ID);
        return id === null ? [] : [id];
      }),
    ),
    Transitioning: idSet(data, "Followers_Transitioning_IDs"),
  };
  const living = recordArray(data.Followers);
  const dead = recordArray(data.Followers_Dead);
  const names = followerNameIndex([living, dead]);

  return {
    deadFollowers: dead.map((follower, index) =>
      // Statuses stay empty for the dead, but pass the real id sets so
      // the elder flag survives death like it does in the save.
      buildFollower(follower, index, statusIds, names, true),
    ),
    followers: living.map((follower, index) =>
      buildFollower(follower, index, statusIds, names, false),
    ),
  };
}

function buildResources(data: SaveRecord): ResourceOverview[] {
  return recordArray(data.items)
    .flatMap((item) => {
      const id = integer(item.type);
      const quantity = finiteNumber(item.quantity);
      if (id === null || quantity === null) {
        return [];
      }
      const knownName = ITEM_NAMES[id];
      const reserved = finiteNumber(item.QuantityReserved);
      return [
        {
          id,
          known: knownName !== undefined,
          name: knownName ?? `Unknown item ${id}`,
          quantity,
          reserved: reserved ?? 0,
          reservedStored: reserved !== null,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id - right.id,
    );
}

function buildDoctrine(data: SaveRecord): DoctrineOverview {
  const selectedIds = numberArray(data.DoctrineUnlockedUpgrades);
  const selectedSet = new Set(selectedIds);
  const knownChoiceIds = new Set<number>();

  const categories = DOCTRINE_CATEGORIES.map((category) => {
    const pairs = category.pairs.map((definition) => {
      for (const candidate of definition.choices) {
        knownChoiceIds.add(candidate.doctrineId);
      }
      const selected = definition.choices.filter((candidate) =>
        selectedSet.has(candidate.doctrineId),
      );
      return {
        choices: definition.choices,
        rank: definition.rank,
        selected,
        state:
          selected.length === 0
            ? "missing"
            : selected.length === 1
              ? "selected"
              : "complete",
      } satisfies DoctrinePairOverview;
    });
    return {
      key: category.key,
      name: category.name,
      pairs,
      selectedCount: pairs.reduce(
        (total, entry) => total + entry.selected.length,
        0,
      ),
    };
  });

  const specialIds = new Set(
    Object.keys(SPECIAL_DOCTRINE_NAMES).map(Number),
  );
  const specials = selectedIds.flatMap((id) => {
    const name = SPECIAL_DOCTRINE_NAMES[id];
    return name === undefined ? [] : [{ id, name }];
  });
  const unknownIds = selectedIds.filter(
    (id) =>
      !knownChoiceIds.has(id) &&
      !specialIds.has(id) &&
      (id < 1 || id > 5),
  );

  return {
    catalogVersion: CATALOG_GAME_VERSION,
    categories,
    selectedChoiceCount: categories.reduce(
      (total, category) => total + category.selectedCount,
      0,
    ),
    specials,
    unknownIds,
  };
}

function buildRituals(data: SaveRecord): NamedId[] {
  return numberArray(data.UnlockedUpgrades)
    .flatMap((id) => {
      const name = RITUAL_NAMES[id];
      return name === undefined ? [] : [{ id, name }];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildSermonsAndRites(data: SaveRecord): NamedId[] {
  return numberArray(data.UnlockedSermonsAndRituals).map((id) => ({
    id,
    name: SERMON_AND_RITE_NAMES[id] ?? `Unknown sermon or rite ${id}`,
  }));
}

export function buildCultOverview(data: SaveRecord): CultOverview {
  const { deadFollowers, followers } = buildFollowers(data);
  const resources = buildResources(data);
  const baseStructures = recordArray(data.BaseStructures);
  const structureTypes = new Set(
    baseStructures.flatMap((structure) => {
      const type = integer(structure.Type);
      return type === null ? [] : [type];
    }),
  );
  const followerCount =
    Array.isArray(data.Followers)
      ? followers.length
      : integer(data.FollowerCount);
  const structureCount =
    Array.isArray(data.BaseStructures)
      ? baseStructures.length
      : integer(data.StructureCount);

  return {
    deadFollowers,
    doctrine: buildDoctrine(data),
    followerCount,
    followers,
    identity: {
      cultLevel: integer(data.CurrentCultLevel),
      day: integer(data.CurrentDayIndex) ?? integer(data.Day),
      difficultyCode: integer(data.Difficulty),
      name: stringValue(data.CultName),
      playTimeSeconds: finiteNumber(data.PlayTime),
    },
    itemTypeCount: Array.isArray(data.items) ? resources.length : null,
    resources,
    rituals: buildRituals(data),
    sermonsAndRites: buildSermonsAndRites(data),
    structureCount,
    structureTypeCount: Array.isArray(data.BaseStructures)
      ? structureTypes.size
      : null,
  };
}
