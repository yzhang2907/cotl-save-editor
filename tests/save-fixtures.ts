import { slot_mp_keys } from "lamb-mp-decoder/dist/keys.js";

import {
  messagePackFieldPosition,
  messagePackSubfieldIndex,
} from "../src/save/messagepack";
import { AES_BLOCK_BYTES } from "../src/save/encryption";
import type {
  MessagePackSource,
  SaveRecord,
} from "../src/save/types";

export const SLOT_SCHEMA = "slot";
export const TEST_CULT_NAME = "The Test Flock";
export const UNKNOWN_CATALOG_ID = 999;
export const UNKNOWN_SLOT_POSITION = 1395;
export const SLOT_POSITION_COUNT = UNKNOWN_SLOT_POSITION + 1;
export const TEST_FIRST_LZ4_BLOCK_BYTES = 701;
export const EMPTY_MESSAGEPACK_ARRAY_BYTE = 0x90;
export const EMPTY_SLOT_MESSAGEPACK_SOURCE: MessagePackSource = {
  compression: null,
  rawData: [],
  rawPayload: new Uint8Array(),
  schema: SLOT_SCHEMA,
};
export const TEST_AES_KEY = Uint8Array.from(
  { length: AES_BLOCK_BYTES },
  (_, index) => index,
);
export const TEST_AES_IV = Uint8Array.from(
  { length: AES_BLOCK_BYTES },
  (_, index) => AES_BLOCK_BYTES - 1 - index,
);

export function concatenateBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export function requiredSlotPosition(field: string): number {
  const position = messagePackFieldPosition(SLOT_SCHEMA, field);
  if (position === null) {
    throw new Error(`Expected ${field} in the slot field map.`);
  }
  return position;
}

/**
 * The length of a raw follower entry, matching the number of mapped
 * subfields a current save stores per follower.
 */
export const RAW_FOLLOWER_LENGTH = 192;

export function rawFollowerIn(
  list: "Followers" | "Followers_Dead",
  fields: Record<string, unknown>,
): unknown[] {
  const entry = Array.from<unknown>({
    length: RAW_FOLLOWER_LENGTH,
  }).fill(null);
  for (const [subfield, value] of Object.entries(fields)) {
    const index = messagePackSubfieldIndex("slot", list, subfield);
    if (index === null) {
      throw new Error(`${list}.${subfield} has no raw index.`);
    }
    entry[index] = value;
  }
  return entry;
}

export function rawFollower(fields: Record<string, unknown>): unknown[] {
  return rawFollowerIn("Followers", fields);
}

export function positionalSlotSave(data: SaveRecord): unknown[] {
  const rawData = Array.from<unknown>({
    length: SLOT_POSITION_COUNT,
  }).fill(null);
  for (const [field, value] of Object.entries(data)) {
    rawData[requiredSlotPosition(field)] = value;
  }
  rawData[UNKNOWN_SLOT_POSITION] = [];
  return rawData;
}

/*
 * The padding pushes the encoded payload past two LZ4 blocks, so a
 * round trip over this fixture exercises the block continuation path
 * that only a full-size save reaches.
 */
function representativeScalar(position: number): unknown {
  const kind = position % 6;
  if (kind === 0) {
    return position;
  }
  if (kind === 1) {
    return `slot-position-${position}-${"x".repeat(200)}`;
  }
  if (kind === 2) {
    return position % 4 === 2;
  }
  if (kind === 3) {
    return position + 0.5;
  }
  if (kind === 4) {
    return [position, position + 1, position + 2];
  }
  return null;
}

/**
 * Builds a raw slot array that populates every mapped position with a
 * representative value: scalars for plain fields, empty lists for
 * positional sub-lists, and empty records for keyed sub-records.
 * Overrides replace named positions with realistic structures.
 */
export function representativeSlotSave(
  overrides: Record<string, unknown> = {},
): unknown[] {
  const keys = slot_mp_keys as Record<
    number,
    string | { keys: unknown; name: string } | undefined
  >;
  const rawData: unknown[] = Array.from(
    { length: SLOT_POSITION_COUNT },
    (_, position) => {
      const descriptor = keys[position];
      if (descriptor === undefined || typeof descriptor === "string") {
        return representativeScalar(position);
      }
      return Array.isArray(descriptor.keys) ? [] : {};
    },
  );
  for (const [field, value] of Object.entries(overrides)) {
    rawData[requiredSlotPosition(field)] = value;
  }
  rawData[UNKNOWN_SLOT_POSITION] = [];
  return rawData;
}
