import { ITEM_NAMES, WOOLHAVEN_ITEM_TYPES } from "./catalogs";
import { dlcDefinition, saveHasActivatedDlc, type DlcKey } from "./dlc";
import { rawValuesMatch } from "./raw-values";
import type { SaveRecord } from "./types";

export const MAX_CULT_NAME_LENGTH = 60;
// The game's naming screen input field serializes m_CharacterLimit as
// 20, but longer names load and save fine in-game, so the editor only
// warns past it instead of blocking.
export const GAME_CULT_NAME_INPUT_LIMIT = 20;
export const MAX_RESOURCE_QUANTITY = 9_999_999;

export interface ResourceEdit {
  quantity: number;
  reserved: number;
  type: number;
}

export interface CultEdits {
  additions: ResourceEdit[];
  cultName: string | null;
  resources: ResourceEdit[];
}

export type PendingCultEdit =
  | {
      from: string;
      kind: "cult-name";
      to: string;
    }
  | {
      itemName: string;
      itemType: number;
      kind: "resource";
      quantityFrom: number;
      quantityTo: number;
      reservedFrom: number;
      reservedTo: number;
    }
  | {
      itemName: string;
      itemType: number;
      kind: "resource-add";
      quantity: number;
      requiredDlc: DlcKey | null;
      reserved: number;
    };

export class CultEditError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CultEditError";
  }
}

interface ItemEntry {
  quantity: number;
  record: SaveRecord;
  reserved: number | null;
  type: number;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function emptyCultEdits(): CultEdits {
  return { additions: [], cultName: null, resources: [] };
}

export function hasCultEdits(edits: CultEdits): boolean {
  return (
    edits.cultName !== null ||
    edits.resources.length > 0 ||
    edits.additions.length > 0
  );
}

export function itemDisplayName(type: number): string {
  return ITEM_NAMES[type] ?? `Unknown item ${type}`;
}

export function itemRequiredDlc(type: number): DlcKey | null {
  return WOOLHAVEN_ITEM_TYPES.has(type) ? "woolhaven" : null;
}

function originalCultName(original: SaveRecord): string {
  const name = original.CultName;
  if (typeof name !== "string") {
    throw new CultEditError(
      "This save does not store an editable cult name.",
    );
  }
  return name;
}

function itemEntry(value: unknown, position: number): ItemEntry {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new CultEditError(
      `Inventory entry ${position} is not a record.`,
    );
  }
  const record = value as SaveRecord;
  if (!isInteger(record.type)) {
    throw new CultEditError(
      `Inventory entry ${position} has no numeric item type.`,
    );
  }
  if (!isInteger(record.quantity)) {
    throw new CultEditError(
      `Item ${record.type} does not store an editable quantity.`,
    );
  }
  const reserved = record.QuantityReserved;
  if (reserved !== undefined && reserved !== null && !isInteger(reserved)) {
    throw new CultEditError(
      `Item ${record.type} does not store an editable reserved quantity.`,
    );
  }
  return {
    quantity: record.quantity,
    record,
    reserved: isInteger(reserved) ? reserved : null,
    type: record.type,
  };
}

function itemEntries(original: SaveRecord): ItemEntry[] {
  if (!Array.isArray(original.items)) {
    throw new CultEditError(
      "This save does not store an editable inventory.",
    );
  }
  const entries = original.items.map(itemEntry);
  const seen = new Set<number>();
  for (const entry of entries) {
    if (seen.has(entry.type)) {
      throw new CultEditError(
        `Item ${entry.type} appears more than once in the inventory.`,
      );
    }
    seen.add(entry.type);
  }
  return entries;
}

function requiredItemEntry(
  original: SaveRecord,
  type: number,
): ItemEntry {
  const entry = itemEntries(original).find(
    (candidate) => candidate.type === type,
  );
  if (entry === undefined) {
    throw new CultEditError(
      `Item ${type} is not in this save's inventory. Only existing items can be edited.`,
    );
  }
  return entry;
}

export function stageCultNameEdit(
  original: SaveRecord,
  edits: CultEdits,
  name: string,
): CultEdits {
  const currentName = originalCultName(original);
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new CultEditError("A cult name cannot be empty.");
  }
  if (trimmed.length > MAX_CULT_NAME_LENGTH) {
    throw new CultEditError(
      `A cult name cannot be longer than ${MAX_CULT_NAME_LENGTH} characters.`,
    );
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new CultEditError(
      "A cult name cannot contain control characters.",
    );
  }
  return {
    ...edits,
    cultName: trimmed === currentName ? null : trimmed,
  };
}

function validateQuantityRange(edit: ResourceEdit): void {
  if (
    !isInteger(edit.quantity) ||
    edit.quantity < 0 ||
    edit.quantity > MAX_RESOURCE_QUANTITY
  ) {
    throw new CultEditError(
      `A quantity must be a whole number between 0 and ${MAX_RESOURCE_QUANTITY.toLocaleString("en-US")}.`,
    );
  }
  if (
    !isInteger(edit.reserved) ||
    edit.reserved < 0 ||
    edit.reserved > MAX_RESOURCE_QUANTITY
  ) {
    throw new CultEditError(
      `A reserved quantity must be a whole number between 0 and ${MAX_RESOURCE_QUANTITY.toLocaleString("en-US")}.`,
    );
  }
  if (edit.reserved > edit.quantity) {
    throw new CultEditError(
      "A reserved quantity cannot be larger than the item quantity.",
    );
  }
}

export function stageResourceEdit(
  original: SaveRecord,
  edits: CultEdits,
  edit: ResourceEdit,
): CultEdits {
  if (
    edits.additions.some((candidate) => candidate.type === edit.type)
  ) {
    validateQuantityRange(edit);
    return {
      ...edits,
      additions: edits.additions.map((candidate) =>
        candidate.type === edit.type ? { ...edit } : candidate,
      ),
    };
  }

  const entry = requiredItemEntry(original, edit.type);
  validateQuantityRange(edit);
  if (entry.reserved === null && edit.reserved !== 0) {
    throw new CultEditError(
      `Item ${edit.type} does not store a reserved quantity, so it must stay 0.`,
    );
  }

  const others = edits.resources.filter(
    (candidate) => candidate.type !== edit.type,
  );
  const unchanged =
    edit.quantity === entry.quantity &&
    edit.reserved === (entry.reserved ?? 0);
  return {
    ...edits,
    resources: unchanged
      ? others
      : [...others, { ...edit }],
  };
}

export function stageResourceAddition(
  original: SaveRecord,
  edits: CultEdits,
  edit: ResourceEdit,
): CultEdits {
  if (ITEM_NAMES[edit.type] === undefined) {
    throw new CultEditError(
      `Item ${edit.type} is not in the known item catalog, so it cannot be added.`,
    );
  }
  if (
    itemEntries(original).some((entry) => entry.type === edit.type)
  ) {
    throw new CultEditError(
      `Item ${edit.type} is already in the inventory. Edit its quantity instead.`,
    );
  }
  const requiredDlc = itemRequiredDlc(edit.type);
  if (requiredDlc !== null && !saveHasActivatedDlc(original, requiredDlc)) {
    throw new CultEditError(
      `${itemDisplayName(edit.type)} requires this save to have ${dlcDefinition(requiredDlc).displayName} activated in the game.`,
    );
  }
  validateQuantityRange(edit);

  const others = edits.additions.filter(
    (candidate) => candidate.type !== edit.type,
  );
  return {
    ...edits,
    additions: [...others, { ...edit }],
  };
}

export function discardCultNameEdit(edits: CultEdits): CultEdits {
  return { ...edits, cultName: null };
}

export function discardResourceEdit(
  edits: CultEdits,
  type: number,
): CultEdits {
  return {
    ...edits,
    additions: edits.additions.filter(
      (candidate) => candidate.type !== type,
    ),
    resources: edits.resources.filter(
      (candidate) => candidate.type !== type,
    ),
  };
}

export function listPendingCultEdits(
  original: SaveRecord,
  edits: CultEdits,
): PendingCultEdit[] {
  const pending: PendingCultEdit[] = [];
  if (edits.cultName !== null) {
    pending.push({
      from: originalCultName(original),
      kind: "cult-name",
      to: edits.cultName,
    });
  }
  for (const edit of edits.resources) {
    const entry = requiredItemEntry(original, edit.type);
    pending.push({
      itemName: itemDisplayName(edit.type),
      itemType: edit.type,
      kind: "resource",
      quantityFrom: entry.quantity,
      quantityTo: edit.quantity,
      reservedFrom: entry.reserved ?? 0,
      reservedTo: edit.reserved,
    });
  }
  for (const edit of edits.additions) {
    pending.push({
      itemName: itemDisplayName(edit.type),
      itemType: edit.type,
      kind: "resource-add",
      quantity: edit.quantity,
      requiredDlc: itemRequiredDlc(edit.type),
      reserved: edit.reserved,
    });
  }
  return pending;
}

function editedItems(
  data: SaveRecord,
  original: SaveRecord,
  edits: CultEdits,
): unknown[] {
  if (
    !Array.isArray(data.items) ||
    !rawValuesMatch(data.items, original.items)
  ) {
    throw new CultEditError(
      "The inventory changed before the staged edits were applied.",
    );
  }
  const remaining = new Map(
    edits.resources.map((edit) => [edit.type, edit]),
  );

  const items = data.items.map((value, position) => {
    const entry = itemEntry(value, position);
    const edit = remaining.get(entry.type);
    if (edit === undefined) {
      return value;
    }
    remaining.delete(entry.type);
    const replacement: SaveRecord = {
      ...entry.record,
      quantity: edit.quantity,
    };
    if (entry.reserved !== null) {
      replacement.QuantityReserved = edit.reserved;
    }
    return replacement;
  });

  if (remaining.size > 0) {
    throw new CultEditError(
      `Item ${[...remaining.keys()].join(", ")} left the inventory before the staged edits were applied.`,
    );
  }

  // New entries mirror the decoded field order of a raw
  // [type, quantity, QuantityReserved] inventory entry.
  for (const addition of edits.additions) {
    items.push({
      type: addition.type,
      quantity: addition.quantity,
      QuantityReserved: addition.reserved,
    });
  }
  return items;
}

export function applyCultEdits(
  data: SaveRecord,
  original: SaveRecord,
  edits: CultEdits,
): SaveRecord {
  if (!hasCultEdits(edits)) {
    return data;
  }

  const result: SaveRecord = { ...data };
  if (edits.cultName !== null) {
    const currentName = originalCultName(original);
    if (data.CultName !== currentName) {
      throw new CultEditError(
        "The cult name changed before the staged edit was applied.",
      );
    }
    stageCultNameEdit(original, emptyCultEdits(), edits.cultName);
    result.CultName = edits.cultName;
  }
  if (edits.resources.length > 0 || edits.additions.length > 0) {
    for (const edit of edits.resources) {
      stageResourceEdit(original, emptyCultEdits(), edit);
    }
    for (const edit of edits.additions) {
      stageResourceAddition(original, emptyCultEdits(), edit);
    }
    result.items = editedItems(data, original, edits);
  }

  for (const key of new Set([
    ...Object.keys(data),
    ...Object.keys(result),
  ])) {
    if (
      key !== "CultName" &&
      key !== "items" &&
      !Object.is(data[key], result[key])
    ) {
      throw new CultEditError(
        `The cult edits changed unapproved field ${key}.`,
      );
    }
  }
  return result;
}
