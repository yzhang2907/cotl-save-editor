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
