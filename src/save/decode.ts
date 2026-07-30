import { decryptPayload, hasEncryptedHeader } from "./encryption";
import { decodeMessagePackPayload } from "./messagepack";
import type { DecodedSave, SaveRecord } from "./types";

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

export class SaveDecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }

  override name = "SaveDecodeError";
}

function isSaveRecord(value: unknown): value is SaveRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

  try {
    const decrypted = new Uint8Array(await decryptPayload(bytes));
    if (firstJsonByte(decrypted) === 0x7b) {
      return {
        data: parsePlainJson(decrypted),
        format: "encrypted-json",
      };
    }

    const decoded = await decodeMessagePackPayload(decrypted);
    return {
      data: decoded.data,
      format: "encrypted-messagepack",
      messagePack: decoded.source,
    };
  } catch (error) {
    if (error instanceof SaveDecodeError) {
      throw error;
    }
    throw new SaveDecodeError(
      "The encrypted save could not be decrypted or decoded.",
      { cause: error },
    );
  }
}
