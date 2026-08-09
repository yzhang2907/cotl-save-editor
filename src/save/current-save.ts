import { decodeSave } from "./decode";
import type { DoctrineStorageField } from "./doctrine-editor";
import { encodeMessagePackSave } from "./encode";
import type { EncryptionOptions } from "./encryption";
import {
  messagePackFieldPosition,
  messagePackRawValuesMatch,
  messagePackSubfieldIndex,
  replaceMessagePackPositions,
  verifyMessagePackPositions,
} from "./messagepack";
import type { MessagePackSource, SaveRecord } from "./types";

type CurrentDoctrineField = Exclude<DoctrineStorageField, "CultTrait">;
type CurrentEditableField = CurrentDoctrineField | "CultName" | "items";

export class CurrentSaveWriteError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CurrentSaveWriteError";
  }
}

function requiredSlotPosition(field: CurrentEditableField): number {
  const position = messagePackFieldPosition("slot", field);
  if (position === null) {
    throw new CurrentSaveWriteError(
      `The supported MessagePack schema does not map ${field}.`,
    );
  }
  return position;
}

function requiredItemIndex(subfield: string): number {
  const index = messagePackSubfieldIndex("slot", "items", subfield);
  if (index === null) {
    throw new CurrentSaveWriteError(
      `The supported MessagePack schema does not map items.${subfield}.`,
    );
  }
  return index;
}

export const CURRENT_DOCTRINE_FIELD_POSITIONS = {
  DoctrineUnlockedUpgrades: requiredSlotPosition(
    "DoctrineUnlockedUpgrades",
  ),
  CultTraits: requiredSlotPosition("CultTraits"),
  UnlockedUpgrades: requiredSlotPosition("UnlockedUpgrades"),
} as const satisfies Record<CurrentDoctrineField, number>;

export const CURRENT_EDITABLE_FIELD_POSITIONS = {
  ...CURRENT_DOCTRINE_FIELD_POSITIONS,
  CultName: requiredSlotPosition("CultName"),
  items: requiredSlotPosition("items"),
} as const satisfies Record<CurrentEditableField, number>;

const ITEM_QUANTITY_SUBFIELDS = {
  quantity: requiredItemIndex("quantity"),
  QuantityReserved: requiredItemIndex("QuantityReserved"),
} as const;

const CURRENT_DOCTRINE_FIELDS = Object.entries(
  CURRENT_DOCTRINE_FIELD_POSITIONS,
) as Array<[CurrentDoctrineField, number]>;
const CURRENT_EDITABLE_FIELDS = Object.entries(
  CURRENT_EDITABLE_FIELD_POSITIONS,
) as Array<[CurrentEditableField, number]>;
const currentEditableFieldNames = new Set<string>(
  CURRENT_EDITABLE_FIELDS.map(([field]) => field),
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
    if (currentEditableFieldNames.has(key)) {
      continue;
    }
    if (!messagePackRawValuesMatch(original[key], working[key])) {
      throw new CurrentSaveWriteError(
        `The working copy changed unapproved field ${String(key)}.`,
      );
    }
  }
}

function itemSubfieldIndex(key: string): number {
  if (key in ITEM_QUANTITY_SUBFIELDS) {
    return ITEM_QUANTITY_SUBFIELDS[
      key as keyof typeof ITEM_QUANTITY_SUBFIELDS
    ];
  }
  const index = messagePackSubfieldIndex("slot", "items", key);
  if (index !== null) {
    return index;
  }
  const numeric = Number(key);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new CurrentSaveWriteError(
      `Inventory field ${key} has no raw MessagePack index.`,
    );
  }
  return numeric;
}

function itemRecord(value: unknown, position: number): SaveRecord {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new CurrentSaveWriteError(
      `Inventory entry ${position} is not a record.`,
    );
  }
  return value as SaveRecord;
}

function assertRawItemMatches(
  rawEntry: unknown,
  record: SaveRecord,
  position: number,
): asserts rawEntry is unknown[] {
  const keys = Object.keys(record);
  if (!Array.isArray(rawEntry) || rawEntry.length !== keys.length) {
    throw new CurrentSaveWriteError(
      `Inventory entry ${position} no longer matches its raw MessagePack layout.`,
    );
  }
  for (const key of keys) {
    if (
      !messagePackRawValuesMatch(
        rawEntry[itemSubfieldIndex(key)],
        record[key],
      )
    ) {
      throw new CurrentSaveWriteError(
        `Inventory entry ${position} no longer matches raw MessagePack field ${key}.`,
      );
    }
  }
}

function quantityValue(
  record: SaveRecord,
  key: string,
  position: number,
): number {
  const value = record[key];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new CurrentSaveWriteError(
      `Inventory entry ${position} does not plan a whole ${key} value.`,
    );
  }
  return value;
}

function plannedItemsValue(
  rawItems: unknown,
  originalItems: unknown,
  workingItems: unknown,
): unknown[] | null {
  if (
    !Array.isArray(rawItems) ||
    !Array.isArray(originalItems) ||
    !Array.isArray(workingItems)
  ) {
    throw new CurrentSaveWriteError(
      "items is not a complete inventory array.",
    );
  }
  if (
    rawItems.length !== originalItems.length ||
    workingItems.length < originalItems.length
  ) {
    throw new CurrentSaveWriteError(
      "The working copy changed the number of inventory entries.",
    );
  }

  let changed = false;
  const replacement = rawItems.map((rawEntry, position) => {
    const originalRecord = itemRecord(originalItems[position], position);
    const workingRecord = itemRecord(workingItems[position], position);
    assertRawItemMatches(rawEntry, originalRecord, position);

    const originalKeys = Object.keys(originalRecord);
    const workingKeys = Object.keys(workingRecord);
    if (
      originalKeys.length !== workingKeys.length ||
      !originalKeys.every((key, index) => key === workingKeys[index])
    ) {
      throw new CurrentSaveWriteError(
        `The working copy changed the fields of inventory entry ${position}.`,
      );
    }

    const changedKeys = originalKeys.filter(
      (key) =>
        !messagePackRawValuesMatch(
          originalRecord[key],
          workingRecord[key],
        ),
    );
    if (changedKeys.length === 0) {
      return rawEntry;
    }
    for (const key of changedKeys) {
      if (!(key in ITEM_QUANTITY_SUBFIELDS)) {
        throw new CurrentSaveWriteError(
          `The working copy changed unapproved inventory field ${key} of entry ${position}.`,
        );
      }
    }

    changed = true;
    const edited = rawEntry.slice();
    for (const key of changedKeys) {
      edited[itemSubfieldIndex(key)] = quantityValue(
        workingRecord,
        key,
        position,
      );
    }
    return edited;
  });

  const originalTypes = new Set(
    originalItems.map(
      (entry, position) => itemRecord(entry, position).type,
    ),
  );
  const appendedKeys = ["type", "quantity", "QuantityReserved"];
  for (
    let position = originalItems.length;
    position < workingItems.length;
    position += 1
  ) {
    const record = itemRecord(workingItems[position], position);
    const keys = Object.keys(record);
    if (
      keys.length !== appendedKeys.length ||
      !appendedKeys.every((key, index) => key === keys[index])
    ) {
      throw new CurrentSaveWriteError(
        `Added inventory entry ${position} does not have the [type, quantity, QuantityReserved] layout.`,
      );
    }
    const type = record.type;
    if (
      typeof type !== "number" ||
      !Number.isSafeInteger(type) ||
      originalTypes.has(type)
    ) {
      throw new CurrentSaveWriteError(
        `Added inventory entry ${position} duplicates or mislabels an item type.`,
      );
    }

    changed = true;
    const rawAddition: unknown[] = [];
    rawAddition[itemSubfieldIndex("type")] = type;
    for (const key of ["quantity", "QuantityReserved"]) {
      rawAddition[itemSubfieldIndex(key)] = quantityValue(
        record,
        key,
        position,
      );
    }
    replacement.push(rawAddition);
  }

  return changed ? replacement : null;
}

function plannedReplacements(
  source: MessagePackSource,
  original: SaveRecord,
  working: SaveRecord,
): Map<number, unknown> {
  if (source.schema !== "slot") {
    throw new CurrentSaveWriteError(
      "Only a current slot MessagePack save can use the save writer.",
    );
  }
  assertOnlyApprovedFieldsChanged(original, working);

  const replacements = new Map<number, unknown>();
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

  const namePosition = CURRENT_EDITABLE_FIELD_POSITIONS.CultName;
  if (!messagePackRawValuesMatch(original.CultName, working.CultName)) {
    if (
      typeof original.CultName !== "string" ||
      typeof working.CultName !== "string"
    ) {
      throw new CurrentSaveWriteError(
        "CultName is not a complete text value.",
      );
    }
    if (
      !messagePackRawValuesMatch(
        source.rawData[namePosition],
        original.CultName,
      )
    ) {
      throw new CurrentSaveWriteError(
        `CultName no longer matches raw MessagePack position ${namePosition}.`,
      );
    }
    replacements.set(namePosition, working.CultName);
  }

  const itemsPosition = CURRENT_EDITABLE_FIELD_POSITIONS.items;
  if (!messagePackRawValuesMatch(original.items, working.items)) {
    const plannedItems = plannedItemsValue(
      source.rawData[itemsPosition],
      original.items,
      working.items,
    );
    if (plannedItems !== null) {
      replacements.set(itemsPosition, plannedItems);
    }
  }

  if (replacements.size === 0) {
    throw new CurrentSaveWriteError(
      "There are no current-save changes to write.",
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
    for (const [field] of CURRENT_EDITABLE_FIELDS) {
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
