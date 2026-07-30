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
    const noun = unknownTopLevelKeys.length === 1 ? "field" : "fields";
    warnings.push(
      `This editor does not have a name for ${unknownTopLevelKeys.length} save ${noun} yet. The data remains visible in Advanced diagnostics and is preserved by an unchanged rebuild.`,
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
      cultTraitsField !== null,
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
