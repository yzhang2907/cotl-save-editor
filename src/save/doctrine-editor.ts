import {
  DOCTRINE_CATEGORIES,
  SPECIAL_DOCTRINE_NAMES,
  type DoctrineChoiceDefinition,
} from "./catalogs";
import {
  dlcDefinition,
  saveHasActivatedDlc,
  type DlcKey,
} from "./dlc";
import type { SaveRecord } from "./types";

export type DoctrineStorageField =
  | "DoctrineUnlockedUpgrades"
  | "CultTraits"
  | "CultTrait"
  | "UnlockedUpgrades";

export interface DoctrineFieldChange {
  added: number[];
  after: number[];
  before: number[];
  changed: boolean;
  field: DoctrineStorageField;
  removed: number[];
}

export interface DoctrineEditingAssessment {
  blockers: string[];
  cultTraitsField: "CultTraits" | "CultTrait" | null;
  declaredPairCount: number;
}

export type DoctrineOperation = "remove" | "replace" | "unlock";

export interface DoctrineChangePlan {
  blockers: string[];
  categoryKey: string | null;
  categoryName: string | null;
  changes: DoctrineFieldChange[];
  from: DoctrineChoiceDefinition | null;
  operation: DoctrineOperation | null;
  rank: number | null;
  requiredDlc: DlcKey | null;
  state: "blocked" | "ready" | "unchanged";
  to: DoctrineChoiceDefinition | null;
}

type DoctrinePairLocation = {
  categoryKey: string;
  categoryName: string;
  choices: [DoctrineChoiceDefinition, DoctrineChoiceDefinition];
  rank: number;
  requiredDlc: DlcKey | null;
};

function numericArray(value: unknown): number[] | null {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        typeof entry === "number" &&
        Number.isSafeInteger(entry),
    )
  ) {
    return null;
  }
  return value.slice();
}

function duplicateValues(values: number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

function knownDoctrineIds(): Set<number> {
  return new Set([
    1,
    2,
    3,
    4,
    5,
    ...DOCTRINE_CATEGORIES.flatMap((category) =>
      category.pairs.flatMap((pair) =>
        pair.choices.map((choice) => choice.doctrineId),
      ),
    ),
    ...Object.keys(SPECIAL_DOCTRINE_NAMES).map(Number),
  ]);
}

function pairLocations(): DoctrinePairLocation[] {
  return DOCTRINE_CATEGORIES.flatMap((category) =>
    category.pairs.map((pair) => ({
      categoryKey: category.key,
      categoryName: category.name,
      choices: pair.choices,
      rank: pair.rank,
      requiredDlc: category.requiredDlc ?? null,
    })),
  );
}

function selectCultTraitsField(
  data: SaveRecord,
  blockers: string[],
): {
  field: "CultTraits" | "CultTrait" | null;
  values: number[] | null;
} {
  const modern = numericArray(data.CultTraits);
  const legacy = numericArray(data.CultTrait);

  if (modern !== null && legacy !== null) {
    blockers.push(
      "Both CultTraits and CultTrait are present. The active trait field is ambiguous.",
    );
    return { field: null, values: null };
  }
  if (modern !== null) {
    return { field: "CultTraits", values: modern };
  }
  if (legacy !== null) {
    return { field: "CultTrait", values: legacy };
  }

  blockers.push(
    "Neither CultTraits nor the legacy CultTrait field is a number array.",
  );
  return { field: null, values: null };
}

export function assessDoctrineEditing(
  data: SaveRecord,
): DoctrineEditingAssessment {
  const blockers: string[] = [];
  const doctrineIds = numericArray(data.DoctrineUnlockedUpgrades);
  const upgradeIds = numericArray(data.UnlockedUpgrades);
  const cultTraits = selectCultTraitsField(data, blockers);

  if (doctrineIds === null) {
    blockers.push("DoctrineUnlockedUpgrades is not a number array.");
  }
  if (upgradeIds === null) {
    blockers.push("UnlockedUpgrades is not a number array.");
  }

  const arrays: Array<[string, number[] | null]> = [
    ["DoctrineUnlockedUpgrades", doctrineIds],
    ["UnlockedUpgrades", upgradeIds],
    [cultTraits.field ?? "CultTraits", cultTraits.values],
  ];
  for (const [field, values] of arrays) {
    if (values === null) {
      continue;
    }
    const duplicates = duplicateValues(values);
    if (duplicates.length > 0) {
      blockers.push(
        `${field} contains duplicate IDs: ${duplicates.join(", ")}.`,
      );
    }
  }

  let declaredPairCount = 0;
  if (doctrineIds !== null) {
    const selectedIds = new Set(doctrineIds);
    const unknownIds = doctrineIds.filter(
      (id) => !knownDoctrineIds().has(id),
    );
    if (unknownIds.length > 0) {
      blockers.push(
        `The doctrine catalog does not know IDs: ${unknownIds.join(", ")}.`,
      );
    }

    for (const pair of pairLocations()) {
      const selected = pair.choices.filter((choice) =>
        selectedIds.has(choice.doctrineId),
      );
      if (selected.length > 0) {
        declaredPairCount += 1;
      }
    }
  }

  return {
    blockers,
    cultTraitsField: cultTraits.field,
    declaredPairCount,
  };
}

function count(values: number[], target: number): number {
  return values.filter((value) => value === target).length;
}

function validateGrantChange(
  field: DoctrineStorageField,
  before: number[],
  fromIds: number[],
  toIds: number[],
  blockers: string[],
): void {
  for (const id of fromIds) {
    if (count(before, id) !== 1) {
      blockers.push(
        `${field} does not contain the expected current ID ${id} exactly once.`,
      );
    }
  }
  for (const id of toIds) {
    if (!fromIds.includes(id) && before.includes(id)) {
      blockers.push(
        `${field} already contains replacement ID ${id}. Its source is unclear.`,
      );
    }
  }
}

function replaceGrants(
  before: number[],
  fromIds: number[],
  toIds: number[],
): number[] {
  const removedIds = new Set(fromIds);
  const firstRemovedIndex = before.findIndex((id) => removedIds.has(id));
  const after = before.filter((id) => !removedIds.has(id));
  const insertionIndex =
    firstRemovedIndex === -1
      ? after.length
      : Math.min(firstRemovedIndex, after.length);
  after.splice(insertionIndex, 0, ...toIds);
  return after;
}

function arraysMatch(left: number[], right: number[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function fieldChange(
  field: DoctrineStorageField,
  before: number[],
  fromIds: number[],
  toIds: number[],
): DoctrineFieldChange {
  const after = replaceGrants(before, fromIds, toIds);
  return {
    added: toIds.filter((id) => !before.includes(id)),
    after,
    before,
    changed: !arraysMatch(before, after),
    field,
    removed: fromIds.filter((id) => !after.includes(id)),
  };
}

function blockedPlan(
  blockers: string[],
  location: DoctrinePairLocation | null = null,
  from: DoctrineChoiceDefinition | null = null,
  to: DoctrineChoiceDefinition | null = null,
): DoctrineChangePlan {
  return {
    blockers,
    categoryKey: location?.categoryKey ?? null,
    categoryName: location?.categoryName ?? null,
    changes: [],
    from,
    operation: null,
    rank: location?.rank ?? null,
    requiredDlc: location?.requiredDlc ?? null,
    state: "blocked",
    to,
  };
}

function selectedChoices(
  location: DoctrinePairLocation,
  doctrineIds: number[],
): DoctrineChoiceDefinition[] {
  return location.choices.filter((choice) =>
    doctrineIds.includes(choice.doctrineId),
  );
}

function missingEarlierRanks(
  location: DoctrinePairLocation,
  doctrineIds: number[],
): number[] {
  return pairLocations()
    .filter(
      (candidate) =>
        candidate.categoryKey === location.categoryKey &&
        candidate.rank < location.rank &&
        selectedChoices(candidate, doctrineIds).length === 0,
    )
    .map((candidate) => candidate.rank);
}

function occupiedLaterRanks(
  location: DoctrinePairLocation,
  doctrineIds: number[],
): number[] {
  return pairLocations()
    .filter(
      (candidate) =>
        candidate.categoryKey === location.categoryKey &&
        candidate.rank > location.rank &&
        selectedChoices(candidate, doctrineIds).length > 0,
    )
    .map((candidate) => candidate.rank);
}

function validateMissingPairGrants(
  field: "CultTraits" | "CultTrait",
  cultTraits: number[],
  upgradeIds: number[],
  location: DoctrinePairLocation,
  blockers: string[],
): void {
  for (const choice of location.choices) {
    for (const id of choice.cultTraitIds) {
      if (cultTraits.includes(id)) {
        blockers.push(
          `${field} already contains ID ${id} for undeclared doctrine ${choice.name}.`,
        );
      }
    }
    for (const id of choice.upgradeIds) {
      if (upgradeIds.includes(id)) {
        blockers.push(
          `UnlockedUpgrades already contains ID ${id} for undeclared doctrine ${choice.name}.`,
        );
      }
    }
  }
}

export function planDoctrineChange(
  data: SaveRecord,
  targetDoctrineId: number,
): DoctrineChangePlan {
  const location =
    pairLocations().find((pair) =>
      pair.choices.some(
        (choice) => choice.doctrineId === targetDoctrineId,
      ),
    ) ?? null;
  if (location === null) {
    return blockedPlan([
      `Doctrine ID ${targetDoctrineId} is not an editable doctrine choice.`,
    ]);
  }

  const target =
    location.choices.find(
      (choice) => choice.doctrineId === targetDoctrineId,
    ) ?? null;
  if (target === null) {
    return blockedPlan(
      [`Doctrine ID ${targetDoctrineId} was not found in its doctrine pair.`],
      location,
    );
  }
  if (
    location.requiredDlc !== null &&
    !saveHasActivatedDlc(data, location.requiredDlc)
  ) {
    const requiredDlc = dlcDefinition(location.requiredDlc);
    return blockedPlan(
      [
        `${location.categoryName} changes require this save to have ${requiredDlc.displayName} activated in the game.`,
      ],
      location,
      null,
      target,
    );
  }

  const assessment = assessDoctrineEditing(data);
  const blockers = assessment.blockers.slice();
  const doctrineIds = numericArray(data.DoctrineUnlockedUpgrades);
  const upgradeIds = numericArray(data.UnlockedUpgrades);
  const cultTraits =
    assessment.cultTraitsField === null
      ? null
      : numericArray(data[assessment.cultTraitsField]);

  if (
    doctrineIds === null ||
    upgradeIds === null ||
    cultTraits === null ||
    assessment.cultTraitsField === null
  ) {
    return blockedPlan(blockers, location, null, target);
  }

  const current = selectedChoices(location, doctrineIds);
  if (current.length === 0) {
    const missingRanks = missingEarlierRanks(location, doctrineIds);
    if (missingRanks.length > 0) {
      blockers.push(
        `${location.categoryName} rank ${location.rank} cannot be unlocked before rank${missingRanks.length === 1 ? "" : "s"} ${missingRanks.join(", ")}.`,
      );
    }
    validateMissingPairGrants(
      assessment.cultTraitsField,
      cultTraits,
      upgradeIds,
      location,
      blockers,
    );
    if (blockers.length > 0) {
      return blockedPlan(blockers, location, null, target);
    }

    return {
      blockers,
      categoryKey: location.categoryKey,
      categoryName: location.categoryName,
      changes: [
        fieldChange(
          "DoctrineUnlockedUpgrades",
          doctrineIds,
          [],
          [target.doctrineId],
        ),
        fieldChange(
          assessment.cultTraitsField,
          cultTraits,
          [],
          target.cultTraitIds,
        ),
        fieldChange(
          "UnlockedUpgrades",
          upgradeIds,
          [],
          target.upgradeIds,
        ),
      ],
      from: null,
      operation: "unlock",
      rank: location.rank,
      requiredDlc: location.requiredDlc,
      state: "ready",
      to: target,
    };
  }
  if (current.length > 1) {
    return {
      blockers,
      categoryKey: location.categoryKey,
      categoryName: location.categoryName,
      changes: [],
      from: target,
      operation: null,
      rank: location.rank,
      requiredDlc: location.requiredDlc,
      state: blockers.length > 0 ? "blocked" : "unchanged",
      to: target,
    };
  }

  const from = current[0] as DoctrineChoiceDefinition;
  if (from.doctrineId === target.doctrineId) {
    return {
      blockers,
      categoryKey: location.categoryKey,
      categoryName: location.categoryName,
      changes: [],
      from,
      operation: null,
      rank: location.rank,
      requiredDlc: location.requiredDlc,
      state: blockers.length > 0 ? "blocked" : "unchanged",
      to: target,
    };
  }

  validateGrantChange(
    assessment.cultTraitsField,
    cultTraits,
    from.cultTraitIds,
    target.cultTraitIds,
    blockers,
  );
  validateGrantChange(
    "UnlockedUpgrades",
    upgradeIds,
    from.upgradeIds,
    target.upgradeIds,
    blockers,
  );
  if (blockers.length > 0) {
    return blockedPlan(blockers, location, from, target);
  }

  const changes = [
    fieldChange(
      "DoctrineUnlockedUpgrades",
      doctrineIds,
      [from.doctrineId],
      [target.doctrineId],
    ),
    fieldChange(
      assessment.cultTraitsField,
      cultTraits,
      from.cultTraitIds,
      target.cultTraitIds,
    ),
    fieldChange(
      "UnlockedUpgrades",
      upgradeIds,
      from.upgradeIds,
      target.upgradeIds,
    ),
  ];

  return {
    blockers,
    categoryKey: location.categoryKey,
    categoryName: location.categoryName,
    changes,
    from,
    operation: "replace",
    rank: location.rank,
    requiredDlc: location.requiredDlc,
    state: "ready",
    to: target,
  };
}

export function planDoctrineRemoval(
  data: SaveRecord,
  targetDoctrineId: number,
): DoctrineChangePlan {
  const location =
    pairLocations().find((pair) =>
      pair.choices.some(
        (choice) => choice.doctrineId === targetDoctrineId,
      ),
    ) ?? null;
  if (location === null) {
    return blockedPlan([
      `Doctrine ID ${targetDoctrineId} is not an editable doctrine choice.`,
    ]);
  }

  const target =
    location.choices.find(
      (choice) => choice.doctrineId === targetDoctrineId,
    ) ?? null;
  if (target === null) {
    return blockedPlan(
      [`Doctrine ID ${targetDoctrineId} was not found in its doctrine pair.`],
      location,
    );
  }

  const assessment = assessDoctrineEditing(data);
  const blockers = assessment.blockers.slice();
  const doctrineIds = numericArray(data.DoctrineUnlockedUpgrades);
  const upgradeIds = numericArray(data.UnlockedUpgrades);
  const cultTraits =
    assessment.cultTraitsField === null
      ? null
      : numericArray(data[assessment.cultTraitsField]);

  if (
    doctrineIds === null ||
    upgradeIds === null ||
    cultTraits === null ||
    assessment.cultTraitsField === null
  ) {
    return blockedPlan(blockers, location, target);
  }

  if (!doctrineIds.includes(target.doctrineId)) {
    return {
      blockers,
      categoryKey: location.categoryKey,
      categoryName: location.categoryName,
      changes: [],
      from: null,
      operation: null,
      rank: location.rank,
      requiredDlc: location.requiredDlc,
      state: blockers.length > 0 ? "blocked" : "unchanged",
      to: target,
    };
  }

  const laterRanks = occupiedLaterRanks(location, doctrineIds);
  if (laterRanks.length > 0) {
    blockers.push(
      `${location.categoryName} rank ${location.rank} cannot be removed while later rank${laterRanks.length === 1 ? "" : "s"} ${laterRanks.join(", ")} ${laterRanks.length === 1 ? "is" : "are"} unlocked.`,
    );
  }
  validateGrantChange(
    assessment.cultTraitsField,
    cultTraits,
    target.cultTraitIds,
    [],
    blockers,
  );
  validateGrantChange(
    "UnlockedUpgrades",
    upgradeIds,
    target.upgradeIds,
    [],
    blockers,
  );
  if (blockers.length > 0) {
    return blockedPlan(blockers, location, target);
  }

  return {
    blockers,
    categoryKey: location.categoryKey,
    categoryName: location.categoryName,
    changes: [
      fieldChange(
        "DoctrineUnlockedUpgrades",
        doctrineIds,
        [target.doctrineId],
        [],
      ),
      fieldChange(
        assessment.cultTraitsField,
        cultTraits,
        target.cultTraitIds,
        [],
      ),
      fieldChange(
        "UnlockedUpgrades",
        upgradeIds,
        target.upgradeIds,
        [],
      ),
    ],
    from: target,
    operation: "remove",
    rank: location.rank,
    requiredDlc: location.requiredDlc,
    state: "ready",
    to: null,
  };
}
