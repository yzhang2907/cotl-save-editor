import {
  encryptPayload,
  type EncryptionOptions,
} from "./encryption";

export async function encodeLegacyJsonSave(
  data: unknown,
  encryption: EncryptionOptions = {},
): Promise<Uint8Array> {
  return encryptPayload(
    new TextEncoder().encode(JSON.stringify(data)),
    encryption,
  );
}
