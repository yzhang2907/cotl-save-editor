import * as lz4 from "@addmaple/lz4/inline";
import { encode, ExtData } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";

import { analyzeSave } from "../src/save/analyze";
import {
  encodeLegacyJson,
  encryptPayload,
} from "../src/save/encryption";
import { decodeSave, SaveDecodeError } from "../src/save/decode";
import { encodeVerifiedMessagePackSave } from "../src/save/encode";
import { sourceWarnings } from "../src/save/source";
import type { SaveRecord } from "../src/save/types";

const sampleSave: SaveRecord = {
  CultName: "The Test Flock",
  UnlockedUpgrades: [110],
  DoctrineUnlockedUpgrades: [32],
  CultTraits: [9],
};

const testKey = Uint8Array.from({ length: 16 }, (_, index) => index);
const testIv = Uint8Array.from({ length: 16 }, (_, index) => 15 - index);

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

function concatenate(parts: Uint8Array[]): Uint8Array {
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

function makePositionalSave(): unknown[] {
  const positionalSave = Array.from<unknown>({ length: 1396 }).fill(null);
  positionalSave[405] = [110];
  positionalSave[406] = [32];
  positionalSave[408] = [9];
  positionalSave[410] = "The Test Flock";
  positionalSave[1395] = [];
  return positionalSave;
}

describe("decodeSave", () => {
  it("reads plaintext JSON with leading whitespace", async () => {
    const bytes = new TextEncoder().encode(` \n${JSON.stringify(sampleSave)}`);
    const result = await decodeSave(exactBuffer(bytes));

    expect(result.format).toBe("plain-json");
    expect(result.data).toEqual(sampleSave);
  });

  it("reads legacy encrypted JSON", async () => {
    const bytes = await encodeLegacyJson(sampleSave);
    const result = await decodeSave(exactBuffer(bytes));

    expect(result.format).toBe("encrypted-json");
    expect(result.data).toEqual(sampleSave);
  });

  it("reads an encrypted uncompressed MessagePack slot", async () => {
    const encrypted = await encryptPayload(encode(makePositionalSave()), {
      key: testKey,
      iv: testIv,
    });
    const result = await decodeSave(exactBuffer(encrypted));

    expect(result.format).toBe("encrypted-messagepack");
    expect(result.data.CultName).toBe("The Test Flock");
    expect(result.data.UnlockedUpgrades).toEqual([110]);
    expect(result.data.DoctrineUnlockedUpgrades).toEqual([32]);
    expect(result.data.CultTraits).toEqual([9]);
    expect(result.data["1395"]).toEqual([]);
  });

  it("round-trips an encrypted multi-block LZ4 MessagePack slot", async () => {
    const innerMessage = encode(makePositionalSave());
    const midpoint = Math.floor(innerMessage.byteLength / 2);
    const blocks = [
      innerMessage.slice(0, midpoint),
      innerMessage.slice(midpoint),
    ];
    const compressed = await Promise.all(
      blocks.map((block) =>
        (
          lz4 as unknown as {
            compressBlock(input: Uint8Array): Promise<Uint8Array>;
          }
        ).compressBlock(block),
      ),
    );
    const lengthHeader = concatenate(
      blocks.map((block) => encode(block.byteLength)),
    );
    const outerMessage = encode([
      new ExtData(98, lengthHeader),
      ...compressed,
    ]);
    const encrypted = await encryptPayload(outerMessage, {
      key: testKey,
      iv: testIv,
    });

    const result = await decodeSave(exactBuffer(encrypted));

    expect(result.format).toBe("encrypted-messagepack");
    expect(result.data.CultName).toBe("The Test Flock");
    expect(result.data.DoctrineUnlockedUpgrades).toEqual([32]);
    expect(result.data["1395"]).toEqual([]);

    if (!result.messagePack) {
      throw new Error("Expected raw MessagePack source data.");
    }
    expect(result.messagePack.compression?.blockSizes).toEqual(
      blocks.map((block) => block.byteLength),
    );
    expect(result.messagePack.rawPayload).toEqual(innerMessage);

    const rewritten = await encodeVerifiedMessagePackSave(result.messagePack, {
      key: testKey,
      iv: testIv,
    });
    const roundTrip = await decodeSave(exactBuffer(rewritten));

    expect(roundTrip.data).toEqual(result.data);
    expect(roundTrip.messagePack?.rawData).toEqual(
      result.messagePack.rawData,
    );
    expect(roundTrip.messagePack?.rawPayload).toEqual(innerMessage);
  });

  it("propagates malformed encrypted data as a decode error", async () => {
    const encrypted = await encryptPayload(
      Uint8Array.of(0xc1, 0xc1, 0xc1),
      {
        key: testKey,
        iv: testIv,
      },
    );

    await expect(decodeSave(exactBuffer(encrypted))).rejects.toBeInstanceOf(
      SaveDecodeError,
    );
  });

  it("rejects malformed JSON with a useful error", async () => {
    const bytes = new TextEncoder().encode("{ definitely not json");

    await expect(decodeSave(exactBuffer(bytes))).rejects.toBeInstanceOf(
      SaveDecodeError,
    );
  });

  it("rejects a generic JSON object that is not a game save", async () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({
        recentProjects: [],
        settings: { theme: "dark" },
        version: 1,
      }),
    );

    await expect(decodeSave(exactBuffer(bytes))).rejects.toThrow(
      "does not look like a Cult of the Lamb save",
    );
  });

  it("rejects unknown binary files before decryption", async () => {
    const bytes = Uint8Array.of(0x01, 0x02, 0x03, 0x04);

    await expect(decodeSave(exactBuffer(bytes))).rejects.toThrow(
      "not a recognized Cult of the Lamb",
    );
  });
});

describe("analyzeSave", () => {
  it("accepts a fully mapped doctrine-compatible save", () => {
    const report = analyzeSave(sampleSave);

    expect(report.canEditDoctrines).toBe(true);
    expect(report.warnings).toEqual([]);
    expect(report.doctrineFields.cultTraitsField).toBe("CultTraits");
  });

  it("supports the singular legacy CultTrait field", () => {
    const report = analyzeSave({
      ...sampleSave,
      CultTraits: undefined,
      CultTrait: [9],
    });

    expect(report.canEditDoctrines).toBe(true);
    expect(report.doctrineFields.cultTraitsField).toBe("CultTrait");
  });

  it("keeps unknown positions visible without hiding doctrine controls", () => {
    const report = analyzeSave({ ...sampleSave, "1395": true });

    expect(report.canEditDoctrines).toBe(true);
    expect(report.unknownTopLevelKeys).toEqual(["1395"]);
    expect(report.warnings).toEqual([
      "This save contains one game-data entry that the editor cannot identify. It will be left unchanged.",
    ]);
  });
});

describe("sourceWarnings", () => {
  it("warns that a legacy JSON may be stale", () => {
    expect(sourceWarnings("slot_0.json", "encrypted-json")).toEqual([
      expect.stringContaining("matching .mp file"),
    ]);
  });

  it("accepts a current MP source without warnings", () => {
    expect(sourceWarnings("slot_0.mp", "encrypted-messagepack")).toEqual([]);
  });
});
