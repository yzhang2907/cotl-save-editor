export type SaveRecord = Record<string, unknown>;

export type SaveFormat =
  | "plain-json"
  | "encrypted-json"
  | "encrypted-messagepack";

export interface DecodedSave {
  data: SaveRecord;
  format: SaveFormat;
  messagePack?: MessagePackSource;
}

export type MessagePackSchema = "slot" | "meta";

export interface MessagePackCompression {
  blockSizes: number[];
}

export interface MessagePackSource {
  compression: MessagePackCompression | null;
  rawData: unknown[];
  rawPayload: Uint8Array;
  schema: MessagePackSchema;
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
  unknownTopLevelKeys: string[];
  warnings: string[];
}
