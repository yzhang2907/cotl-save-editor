import type {
  SaveCompatibilityReport,
  SaveRecord,
} from "./types";

function numericArrayLength(value: unknown): number | null {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "number")) {
    return null;
  }
  return value.length;
}

export function analyzeSave(data: SaveRecord): SaveCompatibilityReport {
  const keys = Object.keys(data);
  const unknownTopLevelKeys = keys.filter((key) => /^\d+$/.test(key));
  const doctrineUnlockCount = numericArrayLength(
    data.DoctrineUnlockedUpgrades,
  );
  const unlockedUpgradeCount = numericArrayLength(data.UnlockedUpgrades);
  const cultTraitsField =
    numericArrayLength(data.CultTraits) !== null
      ? "CultTraits"
      : numericArrayLength(data.CultTrait) !== null
        ? "CultTrait"
        : null;
  const cultTraitsCount = cultTraitsField
    ? numericArrayLength(data[cultTraitsField])
    : null;
  const warnings: string[] = [];

  if (unknownTopLevelKeys.length > 0) {
    warnings.push(
      `${unknownTopLevelKeys.length} positional fields are not recognized by the current schema map.`,
    );
  }
  if (doctrineUnlockCount === null) {
    warnings.push("DoctrineUnlockedUpgrades is missing or is not a number array.");
  }
  if (unlockedUpgradeCount === null) {
    warnings.push("UnlockedUpgrades is missing or is not a number array.");
  }
  if (cultTraitsField === null) {
    warnings.push("Neither CultTraits nor the legacy CultTrait field was found.");
  }

  return {
    canEditDoctrines:
      doctrineUnlockCount !== null &&
      unlockedUpgradeCount !== null &&
      cultTraitsField !== null &&
      unknownTopLevelKeys.length === 0,
    doctrineFields: {
      cultTraitsField,
      cultTraitsCount,
      doctrineUnlockCount,
      unlockedUpgradeCount,
    },
    fieldCount: keys.length,
    unknownTopLevelKeys,
    warnings,
  };
}
