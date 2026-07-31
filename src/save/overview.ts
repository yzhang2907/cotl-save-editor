import {
  CATALOG_GAME_VERSION,
  DOCTRINE_CATEGORIES,
  ITEM_NAMES,
  RITUAL_NAMES,
  SERMON_AND_RITE_NAMES,
  SPECIAL_DOCTRINE_NAMES,
  type DoctrineChoiceDefinition,
} from "./catalogs";
import type { SaveRecord } from "./types";

export interface CultIdentityOverview {
  cultLevel: number | null;
  day: number | null;
  difficultyCode: number | null;
  name: string | null;
  playTimeSeconds: number | null;
}

export interface FollowerOverview {
  age: number | null;
  happiness: number | null;
  id: number | null;
  illness: number | null;
  level: number | null;
  name: string;
  satiation: number | null;
  statuses: string[];
  traitCount: number;
}

export interface ResourceOverview {
  id: number;
  known: boolean;
  name: string;
  quantity: number;
  reserved: number;
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
  if ((integer(follower.CursedState) ?? 0) !== 0) {
    statuses.push("Cursed");
  }
  if (follower.LeavingCult === true) {
    statuses.push("Leaving");
  }

  return statuses.length > 0 ? statuses : ["Active"];
}

function buildFollowers(data: SaveRecord): FollowerOverview[] {
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

  return recordArray(data.Followers).map((follower, index) => ({
    age: integer(follower.Age),
    happiness: finiteNumber(follower._happiness),
    id: integer(follower.ID),
    illness: finiteNumber(follower._illness),
    level: integer(follower.XPLevel),
    name:
      stringValue(follower._name) ??
      stringValue(follower.Name) ??
      `Follower ${index + 1}`,
    satiation: finiteNumber(follower._satiation),
    statuses: followerStatuses(follower, statusIds),
    traitCount: numberArray(follower.Traits).length,
  }));
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
      return [
        {
          id,
          known: knownName !== undefined,
          name: knownName ?? `Unknown item ${id}`,
          quantity,
          reserved: finiteNumber(item.QuantityReserved) ?? 0,
        },
      ];
    })
    .sort((left, right) => {
      const quantityDifference = right.quantity - left.quantity;
      return quantityDifference || left.name.localeCompare(right.name);
    });
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
  const followers = buildFollowers(data);
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
