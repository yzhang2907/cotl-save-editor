import {
  encryptPayload,
  type EncryptionOptions,
} from "./encryption";
import { decodeSave } from "./decode";
import {
  encodeMessagePackPayload,
  messagePackDataMatches,
} from "./messagepack";
import type { MessagePackSource } from "./types";

export async function encodeMessagePackSave(
  source: MessagePackSource,
  encryption: EncryptionOptions = {},
): Promise<Uint8Array> {
  return encryptPayload(
    await encodeMessagePackPayload(source),
    encryption,
  );
}

export async function encodeVerifiedMessagePackSave(
  source: MessagePackSource,
  encryption: EncryptionOptions = {},
): Promise<Uint8Array> {
  const encoded = await encodeMessagePackSave(source, encryption);
  const decoded = await decodeSave(encoded.slice().buffer);

  if (
    decoded.messagePack === undefined ||
    !messagePackDataMatches(source, decoded.messagePack)
  ) {
    throw new Error(
      "The rebuilt save did not pass its local data check.",
    );
  }

  return encoded;
}
