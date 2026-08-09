import * as lz4 from "@addmaple/lz4/inline";
import {
  decode,
  decodeMulti,
  encode,
  ExtData,
} from "@msgpack/msgpack";
import {
  meta_mp_keys,
  slot_mp_keys,
} from "lamb-mp-decoder/dist/keys.js";

import { rawValuesMatch } from "./raw-values";
import type {
  MessagePackSchema,
  MessagePackSource,
  SaveRecord,
} from "./types";

export const MESSAGEPACK_LZ4_EXTENSION = 98;
const DEFAULT_FIRST_BLOCK_BYTES = 4094;
const DEFAULT_BLOCK_BYTES = 32764;

type ExplicitKey = {
  keys: KeyMap | KeyMap[];
  name: string;
};

type KeyDescriptor = ExplicitKey | string;
type KeyMap = Record<number, KeyDescriptor>;

type Lz4Module = {
  compressBlock(input: Uint8Array): Promise<Uint8Array>;
  decompressBlock(
    input: Uint8Array,
    originalSize: number,
  ): Promise<Uint8Array>;
};

type CompressionHeader = {
  data: Uint8Array;
  type: number;
};

type MessagePackArrayLayout = {
  entries: Array<{ end: number; start: number }>;
  headerEnd: number;
};

const lz4Module = lz4 as unknown as Lz4Module;
const schemaKeys: Record<MessagePackSchema, KeyMap> = {
  meta: meta_mp_keys as unknown as KeyMap,
  slot: slot_mp_keys as unknown as KeyMap,
};

export class MessagePackSaveError extends Error {
  override name = "MessagePackSaveError";
}

function concatenate(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }

  return result;
}

function bytesMatch(first: Uint8Array, second: Uint8Array): boolean {
  return (
    first.byteLength === second.byteLength &&
    first.every((byte, index) => byte === second[index])
  );
}

function requireBytes(
  bytes: Uint8Array,
  offset: number,
  length: number,
): number {
  const end = offset + length;
  if (
    !Number.isSafeInteger(end) ||
    length < 0 ||
    end > bytes.byteLength
  ) {
    throw new MessagePackSaveError(
      "The raw MessagePack payload ended unexpectedly.",
    );
  }
  return end;
}

function readUnsigned(
  bytes: Uint8Array,
  offset: number,
  length: 1 | 2 | 4,
): number {
  requireBytes(bytes, offset, length);
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    length,
  );
  if (length === 1) {
    return view.getUint8(0);
  }
  if (length === 2) {
    return view.getUint16(0);
  }
  return view.getUint32(0);
}

function skipValues(
  bytes: Uint8Array,
  offset: number,
  count: number,
  depth: number,
): number {
  let end = offset;
  for (let index = 0; index < count; index += 1) {
    end = skipValue(bytes, end, depth);
  }
  return end;
}

function skipValue(
  bytes: Uint8Array,
  offset: number,
  depth = 0,
): number {
  if (depth > 512) {
    throw new MessagePackSaveError(
      "The raw MessagePack payload is nested too deeply.",
    );
  }

  const marker = bytes[offset];
  if (marker === undefined) {
    throw new MessagePackSaveError(
      "The raw MessagePack payload ended unexpectedly.",
    );
  }
  let cursor = offset + 1;

  if (marker <= 0x7f || marker >= 0xe0) {
    return cursor;
  }
  if (marker >= 0x80 && marker <= 0x8f) {
    return skipValues(bytes, cursor, (marker & 0x0f) * 2, depth + 1);
  }
  if (marker >= 0x90 && marker <= 0x9f) {
    return skipValues(bytes, cursor, marker & 0x0f, depth + 1);
  }
  if (marker >= 0xa0 && marker <= 0xbf) {
    return requireBytes(bytes, cursor, marker & 0x1f);
  }

  switch (marker) {
    case 0xc0:
    case 0xc2:
    case 0xc3:
      return cursor;
    case 0xc4:
    case 0xd9: {
      const length = readUnsigned(bytes, cursor, 1);
      return requireBytes(bytes, cursor + 1, length);
    }
    case 0xc5:
    case 0xda: {
      const length = readUnsigned(bytes, cursor, 2);
      return requireBytes(bytes, cursor + 2, length);
    }
    case 0xc6:
    case 0xdb: {
      const length = readUnsigned(bytes, cursor, 4);
      return requireBytes(bytes, cursor + 4, length);
    }
    case 0xc7: {
      const length = readUnsigned(bytes, cursor, 1);
      return requireBytes(bytes, cursor + 2, length);
    }
    case 0xc8: {
      const length = readUnsigned(bytes, cursor, 2);
      return requireBytes(bytes, cursor + 3, length);
    }
    case 0xc9: {
      const length = readUnsigned(bytes, cursor, 4);
      return requireBytes(bytes, cursor + 5, length);
    }
    case 0xca:
      return requireBytes(bytes, cursor, 4);
    case 0xcb:
      return requireBytes(bytes, cursor, 8);
    case 0xcc:
    case 0xd0:
      return requireBytes(bytes, cursor, 1);
    case 0xcd:
    case 0xd1:
      return requireBytes(bytes, cursor, 2);
    case 0xce:
    case 0xd2:
      return requireBytes(bytes, cursor, 4);
    case 0xcf:
    case 0xd3:
      return requireBytes(bytes, cursor, 8);
    case 0xd4:
      return requireBytes(bytes, cursor, 2);
    case 0xd5:
      return requireBytes(bytes, cursor, 3);
    case 0xd6:
      return requireBytes(bytes, cursor, 5);
    case 0xd7:
      return requireBytes(bytes, cursor, 9);
    case 0xd8:
      return requireBytes(bytes, cursor, 17);
    case 0xdc: {
      const count = readUnsigned(bytes, cursor, 2);
      return skipValues(bytes, cursor + 2, count, depth + 1);
    }
    case 0xdd: {
      const count = readUnsigned(bytes, cursor, 4);
      return skipValues(bytes, cursor + 4, count, depth + 1);
    }
    case 0xde: {
      const count = readUnsigned(bytes, cursor, 2);
      return skipValues(bytes, cursor + 2, count * 2, depth + 1);
    }
    case 0xdf: {
      const count = readUnsigned(bytes, cursor, 4);
      return skipValues(bytes, cursor + 4, count * 2, depth + 1);
    }
    default:
      throw new MessagePackSaveError(
        `The raw MessagePack payload contains unsupported marker 0x${marker.toString(16).padStart(2, "0")}.`,
      );
  }
}

function arrayLayout(payload: Uint8Array): MessagePackArrayLayout {
  const marker = payload[0];
  if (marker === undefined) {
    throw new MessagePackSaveError(
      "The raw MessagePack payload is empty.",
    );
  }

  let count: number;
  let cursor: number;
  if (marker >= 0x90 && marker <= 0x9f) {
    count = marker & 0x0f;
    cursor = 1;
  } else if (marker === 0xdc) {
    count = readUnsigned(payload, 1, 2);
    cursor = 3;
  } else if (marker === 0xdd) {
    count = readUnsigned(payload, 1, 4);
    cursor = 5;
  } else {
    throw new MessagePackSaveError(
      "The raw MessagePack save is not a positional array.",
    );
  }

  const headerEnd = cursor;
  const entries: MessagePackArrayLayout["entries"] = [];
  for (let position = 0; position < count; position += 1) {
    const start = cursor;
    cursor = skipValue(payload, cursor);
    entries.push({ end: cursor, start });
  }
  if (cursor !== payload.byteLength) {
    throw new MessagePackSaveError(
      "The raw MessagePack payload has trailing data.",
    );
  }
  return { entries, headerEnd };
}

function isCompressionHeader(value: unknown): value is CompressionHeader {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CompressionHeader>;
  return (
    candidate.type === MESSAGEPACK_LZ4_EXTENSION &&
    candidate.data instanceof Uint8Array
  );
}

function decodeBlockSizes(header: Uint8Array): number[] {
  const sizes = Array.from(decodeMulti(header));

  if (
    sizes.length === 0 ||
    !sizes.every(
      (size): size is number =>
        typeof size === "number" &&
        Number.isSafeInteger(size) &&
        size > 0,
    )
  ) {
    throw new MessagePackSaveError(
      "The MessagePack compression header has invalid block sizes.",
    );
  }

  return sizes;
}

function addKeys(
  value: unknown,
  keys: KeyMap,
  path = "$",
): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object") {
    return value;
  }

  const result: SaveRecord = {};
  for (const [position, entry] of Object.entries(value)) {
    const descriptor = keys[Number(position)];

    if (typeof descriptor === "string") {
      result[descriptor] = entry;
      continue;
    }
    if (descriptor === undefined) {
      result[position] = entry;
      continue;
    }
    if (entry === null || entry === undefined) {
      result[descriptor.name] = entry;
      continue;
    }

    if (Array.isArray(descriptor.keys)) {
      if (!Array.isArray(entry) || descriptor.keys[0] === undefined) {
        throw new MessagePackSaveError(
          `${path}.${descriptor.name} is not a positional array.`,
        );
      }
      result[descriptor.name] = entry.map((item, index) =>
        addKeys(
          item,
          descriptor.keys[0] as KeyMap,
          `${path}.${descriptor.name}[${index}]`,
        ),
      );
      continue;
    }

    result[descriptor.name] = addKeys(
      entry,
      descriptor.keys,
      `${path}.${descriptor.name}`,
    );
  }

  return result;
}

async function decompressMessage(
  message: unknown[],
): Promise<{ blockSizes: number[]; payload: Uint8Array }> {
  const header = message[0];
  if (!isCompressionHeader(header)) {
    throw new MessagePackSaveError(
      "The MessagePack compression header is missing.",
    );
  }

  const blockSizes = decodeBlockSizes(header.data);
  const compressedBlocks = message.slice(1);
  if (
    compressedBlocks.length !== blockSizes.length ||
    !compressedBlocks.every(
      (block): block is Uint8Array => block instanceof Uint8Array,
    )
  ) {
    throw new MessagePackSaveError(
      "The MessagePack compressed blocks do not match their header.",
    );
  }

  const blocks = await Promise.all(
    compressedBlocks.map((block, index) =>
      lz4Module.decompressBlock(block, blockSizes[index] as number),
    ),
  );

  return { blockSizes, payload: concatenate(blocks) };
}

export async function decodeMessagePackPayload(
  payload: Uint8Array,
): Promise<{ data: SaveRecord; source: MessagePackSource }> {
  const outer = decode(payload, { useBigInt64: true });
  let rawPayload = payload;
  let blockSizes: number[] | null = null;

  if (
    Array.isArray(outer) &&
    isCompressionHeader(outer[0])
  ) {
    const decompressed = await decompressMessage(outer);
    rawPayload = decompressed.payload;
    blockSizes = decompressed.blockSizes;
  }

  const rawData = decode(rawPayload, { useBigInt64: true });
  if (!Array.isArray(rawData)) {
    throw new MessagePackSaveError(
      "The MessagePack save does not contain a positional array.",
    );
  }

  const schema: MessagePackSchema = rawData.length < 100 ? "meta" : "slot";
  const data = addKeys(rawData, schemaKeys[schema]);
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new MessagePackSaveError(
      "The MessagePack save does not contain a record.",
    );
  }

  return {
    data: data as SaveRecord,
    source: {
      compression: blockSizes === null ? null : { blockSizes },
      rawData,
      rawPayload: rawPayload.slice(),
      schema,
    },
  };
}

function splitPayload(
  payload: Uint8Array,
  preferredSizes: number[],
): Uint8Array[] {
  const blocks: Uint8Array[] = [];
  let offset = 0;

  for (const preferredSize of preferredSizes) {
    if (offset >= payload.byteLength) {
      break;
    }
    const end = Math.min(offset + preferredSize, payload.byteLength);
    blocks.push(payload.slice(offset, end));
    offset = end;
  }

  const nextBlockSize =
    preferredSizes.length > 1
      ? Math.max(...preferredSizes.slice(1))
      : DEFAULT_BLOCK_BYTES;
  while (offset < payload.byteLength) {
    const end = Math.min(offset + nextBlockSize, payload.byteLength);
    blocks.push(payload.slice(offset, end));
    offset = end;
  }

  return blocks;
}

export async function encodeMessagePackPayload(
  source: MessagePackSource,
): Promise<Uint8Array> {
  const payload = source.rawPayload.slice();
  if (source.compression === null) {
    return payload;
  }

  const preferredSizes =
    source.compression.blockSizes.length > 0
      ? source.compression.blockSizes
      : [DEFAULT_FIRST_BLOCK_BYTES, DEFAULT_BLOCK_BYTES];
  const blocks = splitPayload(payload, preferredSizes);
  const compressedBlocks = await Promise.all(
    blocks.map((block) => lz4Module.compressBlock(block)),
  );
  const header = concatenate(
    blocks.map((block) => encode(block.byteLength)),
  );

  return encode(
    [
      new ExtData(MESSAGEPACK_LZ4_EXTENSION, header),
      ...compressedBlocks,
    ],
    { useBigInt64: true },
  );
}

export function messagePackFieldPosition(
  schema: MessagePackSchema,
  field: string,
): number | null {
  const matches = Object.entries(schemaKeys[schema]).flatMap(
    ([position, descriptor]) => {
      const name =
        typeof descriptor === "string" ? descriptor : descriptor.name;
      return name === field ? [Number(position)] : [];
    },
  );
  if (matches.length > 1) {
    throw new MessagePackSaveError(
      `${field} has more than one ${schema} MessagePack position.`,
    );
  }
  return matches[0] ?? null;
}

export function messagePackSubfieldIndex(
  schema: MessagePackSchema,
  field: string,
  subfield: string,
): number | null {
  const descriptor = Object.values(schemaKeys[schema]).find(
    (candidate) =>
      typeof candidate !== "string" && candidate.name === field,
  );
  if (
    descriptor === undefined ||
    typeof descriptor === "string" ||
    !Array.isArray(descriptor.keys) ||
    descriptor.keys[0] === undefined
  ) {
    return null;
  }

  const matches = Object.entries(descriptor.keys[0]).flatMap(
    ([position, entry]) => {
      const name = typeof entry === "string" ? entry : entry.name;
      return name === subfield ? [Number(position)] : [];
    },
  );
  if (matches.length > 1) {
    throw new MessagePackSaveError(
      `${field}.${subfield} has more than one ${schema} MessagePack index.`,
    );
  }
  return matches[0] ?? null;
}

export function replaceMessagePackPositions(
  source: MessagePackSource,
  replacements: ReadonlyMap<number, unknown>,
): MessagePackSource {
  if (replacements.size === 0) {
    throw new MessagePackSaveError(
      "No MessagePack positions were selected for replacement.",
    );
  }

  const layout = arrayLayout(source.rawPayload);
  if (source.rawData.length !== layout.entries.length) {
    throw new MessagePackSaveError(
      "The decoded and encoded MessagePack position counts do not match.",
    );
  }
  const decoded = decode(source.rawPayload, { useBigInt64: true });
  if (
    !Array.isArray(decoded) ||
    !rawValuesMatch(decoded, source.rawData)
  ) {
    throw new MessagePackSaveError(
      "The retained raw MessagePack data changed before writing.",
    );
  }

  for (const position of replacements.keys()) {
    if (
      !Number.isSafeInteger(position) ||
      position < 0 ||
      position >= layout.entries.length
    ) {
      throw new MessagePackSaveError(
        `MessagePack position ${position} is outside the save.`,
      );
    }
  }

  const rawData = source.rawData.slice();
  const payloadParts = [
    source.rawPayload.slice(0, layout.headerEnd),
  ];
  layout.entries.forEach((entry, position) => {
    if (replacements.has(position)) {
      const replacement = replacements.get(position);
      rawData[position] = replacement;
      payloadParts.push(encode(replacement, { useBigInt64: true }));
    } else {
      payloadParts.push(source.rawPayload.slice(entry.start, entry.end));
    }
  });

  return {
    compression:
      source.compression === null
        ? null
        : { blockSizes: source.compression.blockSizes.slice() },
    rawData,
    rawPayload: concatenate(payloadParts),
    schema: source.schema,
  };
}

export function verifyMessagePackPositions(
  source: MessagePackSource,
  candidate: MessagePackSource,
  replacements: ReadonlyMap<number, unknown>,
): void {
  if (source.schema !== candidate.schema) {
    throw new MessagePackSaveError(
      "The written save reopened with a different MessagePack schema.",
    );
  }

  const sourceLayout = arrayLayout(source.rawPayload);
  const candidateLayout = arrayLayout(candidate.rawPayload);
  if (
    sourceLayout.entries.length !== candidateLayout.entries.length ||
    source.rawData.length !== sourceLayout.entries.length ||
    candidate.rawData.length !== candidateLayout.entries.length
  ) {
    throw new MessagePackSaveError(
      "The written save reopened with a different position count.",
    );
  }
  if (
    !bytesMatch(
      source.rawPayload.slice(0, sourceLayout.headerEnd),
      candidate.rawPayload.slice(0, candidateLayout.headerEnd),
    )
  ) {
    throw new MessagePackSaveError(
      "The written save changed its positional array header.",
    );
  }

  for (let position = 0; position < sourceLayout.entries.length; position += 1) {
    const expected = replacements.get(position);
    if (replacements.has(position)) {
      if (!rawValuesMatch(candidate.rawData[position], expected)) {
        throw new MessagePackSaveError(
          `The written save did not keep the planned value at position ${position}.`,
        );
      }
      continue;
    }

    const sourceEntry = sourceLayout.entries[position];
    const candidateEntry = candidateLayout.entries[position];
    if (
      sourceEntry === undefined ||
      candidateEntry === undefined ||
      !bytesMatch(
        source.rawPayload.slice(sourceEntry.start, sourceEntry.end),
        candidate.rawPayload.slice(candidateEntry.start, candidateEntry.end),
      )
    ) {
      throw new MessagePackSaveError(
        `The written save changed unapproved position ${position}.`,
      );
    }
  }
}

export function messagePackRawValuesMatch(
  first: unknown,
  second: unknown,
): boolean {
  return rawValuesMatch(first, second);
}

export function messagePackDataMatches(
  first: MessagePackSource,
  second: MessagePackSource,
): boolean {
  if (first.schema !== second.schema) {
    return false;
  }

  const firstData = first.rawPayload;
  const secondData = second.rawPayload;
  return bytesMatch(firstData, secondData);
}
