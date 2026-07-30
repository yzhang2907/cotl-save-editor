export type SaveRecord = Record<string, unknown>;

export type SaveFormat =
  | "plain-json"
  | "encrypted-json"
  | "encrypted-messagepack";

export interface DecodedSave {
  data: SaveRecord;
  format: SaveFormat;
}

export interface DoctrineFieldReport {
  cultTraitsField: "CultTraits" | "CultTrait" | null;
  cultTraitsCount: number | null;
  doctrineUnlockCount: number | null;
  unlockedUpgradeCount: number | null;
}

export interface SaveCompatibilityReport {
  canEditDoctrines: boolean;
  doctrineFields: DoctrineFieldReport;
  fieldCount: number;
  unknownTopLevelKeys: string[];
  warnings: string[];
}
