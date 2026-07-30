import * as lz4 from "@addmaple/lz4/inline";
import { LambMPDecoder, SaveType } from "lamb-mp-decoder";

import { decryptAesCbc, hasEncryptedHeader } from "./encryption";
import type { DecodedSave, SaveRecord } from "./types";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

type Lz4Module = {
  decompressBlock(
    input: Uint8Array,
    originalSize: number,
  ): Promise<Uint8Array>;
};

export class SaveDecodeError extends Error {
  override name = "SaveDecodeError";
}

function isSaveRecord(value: unknown): value is SaveRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

function firstJsonByte(bytes: Uint8Array): number | undefined {
  let index = 0;

  if (
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    index = 3;
  }

  while (
    bytes[index] === 0x20 ||
    bytes[index] === 0x09 ||
    bytes[index] === 0x0a ||
    bytes[index] === 0x0d
  ) {
    index += 1;
  }

  return bytes[index];
}

function parsePlainJson(bytes: Uint8Array): SaveRecord {
  try {
    const text = utf8Decoder.decode(bytes).replace(/^\uFEFF/, "");
    const data: unknown = JSON.parse(text);
    if (!isSaveRecord(data)) {
      throw new SaveDecodeError("The save JSON must contain an object.");
    }
    return data;
  } catch (error) {
    if (error instanceof SaveDecodeError) {
      throw error;
    }
    throw new SaveDecodeError("The file looks like JSON but could not be parsed.");
  }
}

export async function decodeSave(input: ArrayBuffer): Promise<DecodedSave> {
  const bytes = new Uint8Array(input);

  if (bytes.byteLength === 0) {
    throw new SaveDecodeError("The selected file is empty.");
  }

  if (firstJsonByte(bytes) === 0x7b) {
    return { data: parsePlainJson(bytes), format: "plain-json" };
  }

  if (!hasEncryptedHeader(bytes)) {
    throw new SaveDecodeError(
      "This is not a recognized Cult of the Lamb JSON or encrypted save.",
    );
  }

  const decoder = new LambMPDecoder({
    decrypt: decryptAesCbc,
    decompress: async (compressed, originalSize) =>
      (lz4 as unknown as Lz4Module).decompressBlock(
        compressed,
        originalSize,
      ),
  });

  try {
    const decoded = await decoder.readSave(exactBuffer(bytes));
    if (!isSaveRecord(decoded.data)) {
      throw new SaveDecodeError("The decoded save did not contain an object.");
    }

    if (decoded.type === SaveType.EncryptedJSON) {
      return { data: decoded.data, format: "encrypted-json" };
    }
    if (decoded.type === SaveType.EncryptedMP) {
      return { data: decoded.data, format: "encrypted-messagepack" };
    }

    throw new SaveDecodeError(`Unexpected decoded format: ${decoded.type}.`);
  } catch (error) {
    if (error instanceof SaveDecodeError) {
      throw error;
    }
    throw new SaveDecodeError(
      "The encrypted save could not be decrypted or decoded.",
    );
  }
}
