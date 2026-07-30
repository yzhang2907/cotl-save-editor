const ENCRYPTED_MARKER = 0x45;
const AES_BLOCK_BYTES = 16;
const ENCRYPTED_HEADER_BYTES = 1 + AES_BLOCK_BYTES * 2;

function copyBuffer(bytes: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) {
    return bytes.slice(0);
  }

  return new Uint8Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).slice().buffer;
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

export async function decryptAesCbc(
  key: ArrayBuffer,
  iv: ArrayBuffer,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    copyBuffer(key),
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  return crypto.subtle.decrypt(
    { name: "AES-CBC", iv: new Uint8Array(copyBuffer(iv)) },
    cryptoKey,
    copyBuffer(data),
  );
}

export async function encryptPayload(
  payload: Uint8Array,
  options: { key?: Uint8Array; iv?: Uint8Array } = {},
): Promise<Uint8Array> {
  const key = new Uint8Array(
    options.key
      ? copyBuffer(options.key)
      : crypto.getRandomValues(new Uint8Array(16)).buffer,
  );
  const iv = new Uint8Array(
    options.iv
      ? copyBuffer(options.iv)
      : crypto.getRandomValues(new Uint8Array(16)).buffer,
  );

  if (key.byteLength !== AES_BLOCK_BYTES || iv.byteLength !== AES_BLOCK_BYTES) {
    throw new Error("Cult of the Lamb saves require a 16-byte key and IV.");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    copyBuffer(payload),
  );

  return concatenate([
    Uint8Array.of(ENCRYPTED_MARKER),
    key,
    iv,
    new Uint8Array(encrypted),
  ]);
}

export async function encodeLegacyJson(data: unknown): Promise<Uint8Array> {
  return encryptPayload(new TextEncoder().encode(JSON.stringify(data)));
}

export function hasEncryptedHeader(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= ENCRYPTED_HEADER_BYTES &&
    bytes[0] === ENCRYPTED_MARKER
  );
}
