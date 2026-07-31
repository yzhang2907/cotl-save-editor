import { decodeSave } from "./decode";
import type { DoctrineStorageField } from "./doctrine-editor";
import { encodeMessagePackSave } from "./encode";
import type { EncryptionOptions } from "./encryption";
import {
  messagePackFieldPosition,
  messagePackRawValuesMatch,
  replaceMessagePackPositions,
  verifyMessagePackPositions,
} from "./messagepack";
import type { MessagePackSource, SaveRecord } from "./types";

type CurrentDoctrineField = Exclude<DoctrineStorageField, "CultTrait">;

export class CurrentSaveWriteError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CurrentSaveWriteError";
  }
}

function requiredSlotPosition(field: CurrentDoctrineField): number {
  const position = messagePackFieldPosition("slot", field);
  if (position === null) {
    throw new CurrentSaveWriteError(
      `The supported MessagePack schema does not map ${field}.`,
    );
  }
  return position;
}

export const CURRENT_DOCTRINE_FIELD_POSITIONS = {
  DoctrineUnlockedUpgrades: requiredSlotPosition(
    "DoctrineUnlockedUpgrades",
  ),
  CultTraits: requiredSlotPosition("CultTraits"),
  UnlockedUpgrades: requiredSlotPosition("UnlockedUpgrades"),
} as const satisfies Record<CurrentDoctrineField, number>;

const CURRENT_DOCTRINE_FIELDS = Object.entries(
  CURRENT_DOCTRINE_FIELD_POSITIONS,
) as Array<[CurrentDoctrineField, number]>;
const currentDoctrineFieldNames = new Set<string>(
  CURRENT_DOCTRINE_FIELDS.map(([field]) => field),
);

function numberArray(value: unknown): number[] | null {
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
  return value;
}

function assertOnlyApprovedFieldsChanged(
  original: SaveRecord,
  working: SaveRecord,
): void {
  const keys = new Set([
    ...Object.keys(original),
    ...Object.keys(working),
  ]);
  for (const key of keys) {
    const originalHasKey = Object.hasOwn(original, key);
    const workingHasKey = Object.hasOwn(working, key);
    if (originalHasKey !== workingHasKey) {
      throw new CurrentSaveWriteError(
        `The working copy changed the presence of unapproved field ${String(key)}.`,
      );
    }
    if (currentDoctrineFieldNames.has(key)) {
      continue;
    }
    if (!messagePackRawValuesMatch(original[key], working[key])) {
      throw new CurrentSaveWriteError(
        `The working copy changed unapproved field ${String(key)}.`,
      );
    }
  }
}

function plannedReplacements(
  source: MessagePackSource,
  original: SaveRecord,
  working: SaveRecord,
): Map<number, number[]> {
  if (source.schema !== "slot") {
    throw new CurrentSaveWriteError(
      "Only a current slot MessagePack save can use the doctrine writer.",
    );
  }
  assertOnlyApprovedFieldsChanged(original, working);

  const replacements = new Map<number, number[]>();
  for (const [field, position] of CURRENT_DOCTRINE_FIELDS) {
    const originalValue = numberArray(original[field]);
    const workingValue = numberArray(working[field]);
    if (originalValue === null || workingValue === null) {
      throw new CurrentSaveWriteError(
        `${field} is not a complete number array.`,
      );
    }
    if (
      !messagePackRawValuesMatch(
        source.rawData[position],
        originalValue,
      )
    ) {
      throw new CurrentSaveWriteError(
        `${field} no longer matches raw MessagePack position ${position}.`,
      );
    }
    if (!messagePackRawValuesMatch(originalValue, workingValue)) {
      replacements.set(position, workingValue.slice());
    }
  }

  if (replacements.size === 0) {
    throw new CurrentSaveWriteError(
      "There are no current-save doctrine changes to write.",
    );
  }
  return replacements;
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export async function encodeVerifiedModifiedCurrentSave(
  source: MessagePackSource,
  original: SaveRecord,
  working: SaveRecord,
  encryption: EncryptionOptions = {},
): Promise<Uint8Array> {
  try {
    const replacements = plannedReplacements(source, original, working);
    const modifiedSource = replaceMessagePackPositions(
      source,
      replacements,
    );
    const encoded = await encodeMessagePackSave(
      modifiedSource,
      encryption,
    );

    // Reopen the fully compressed and encrypted file in memory before it can
    // be offered to a download flow.
    const reopened = await decodeSave(exactBuffer(encoded));
    if (
      reopened.format !== "encrypted-messagepack" ||
      reopened.messagePack === undefined
    ) {
      throw new CurrentSaveWriteError(
        "The written file did not reopen as a current MessagePack save.",
      );
    }

    verifyMessagePackPositions(
      source,
      reopened.messagePack,
      replacements,
    );
    for (const [field] of CURRENT_DOCTRINE_FIELDS) {
      if (
        !messagePackRawValuesMatch(
          reopened.data[field],
          working[field],
        )
      ) {
        throw new CurrentSaveWriteError(
          `The reopened save did not contain the planned ${field} value.`,
        );
      }
    }

    return encoded;
  } catch (error) {
    if (error instanceof CurrentSaveWriteError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Unknown write error.";
    throw new CurrentSaveWriteError(
      `The modified current save was not written: ${message}`,
      { cause: error },
    );
  }
}
