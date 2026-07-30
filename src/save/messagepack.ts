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

import type {
  MessagePackSchema,
  MessagePackSource,
  SaveRecord,
} from "./types";

const MESSAGEPACK_LZ4_EXTENSION = 98;
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

export function messagePackDataMatches(
  first: MessagePackSource,
  second: MessagePackSource,
): boolean {
  if (first.schema !== second.schema) {
    return false;
  }

  const firstData = first.rawPayload;
  const secondData = second.rawPayload;
  return (
    firstData.byteLength === secondData.byteLength &&
    firstData.every((byte, index) => byte === secondData[index])
  );
}
