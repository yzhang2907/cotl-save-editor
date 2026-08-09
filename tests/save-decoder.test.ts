import * as lz4 from "@addmaple/lz4/inline";
import { encode, ExtData } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";

import { analyzeSave } from "../src/save/analyze";
import {
  encryptPayload,
} from "../src/save/encryption";
import { decodeSave, SaveDecodeError } from "../src/save/decode";
import { encodeVerifiedMessagePackSave } from "../src/save/encode";
import { MESSAGEPACK_LZ4_EXTENSION } from "../src/save/messagepack";
import { sourceWarnings } from "../src/save/source";
import type { SaveRecord } from "../src/save/types";
import {
  BELIEF_IN_SACRIFICE,
  RITUAL_OF_RESURRECTION,
} from "./doctrine-fixtures";
import {
  concatenateBytes,
  exactBuffer,
  positionalSlotSave,
  TEST_AES_IV,
  TEST_AES_KEY,
  TEST_CULT_NAME,
  UNKNOWN_SLOT_POSITION,
} from "./save-fixtures";

const sampleSave: SaveRecord = {
  CultName: TEST_CULT_NAME,
  UnlockedUpgrades: RITUAL_OF_RESURRECTION.upgradeIds,
  DoctrineUnlockedUpgrades: [RITUAL_OF_RESURRECTION.doctrineId],
  CultTraits: BELIEF_IN_SACRIFICE.cultTraitIds,
};

function makePositionalSave(): unknown[] {
  return positionalSlotSave(sampleSave);
}

describe("decodeSave", () => {
  it("reads plaintext JSON with leading whitespace", async () => {
    const bytes = new TextEncoder().encode(` \n${JSON.stringify(sampleSave)}`);
    const result = await decodeSave(exactBuffer(bytes));

    expect(result.format).toBe("plain-json");
    expect(result.data).toEqual(sampleSave);
  });

  it("reads legacy encrypted JSON", async () => {
    const bytes = await encryptPayload(
      new TextEncoder().encode(JSON.stringify(sampleSave)),
    );
    const result = await decodeSave(exactBuffer(bytes));

    expect(result.format).toBe("encrypted-json");
    expect(result.data).toEqual(sampleSave);
  });

  it("reads an encrypted uncompressed MessagePack slot", async () => {
    const encrypted = await encryptPayload(encode(makePositionalSave()), {
      key: TEST_AES_KEY,
      iv: TEST_AES_IV,
    });
    const result = await decodeSave(exactBuffer(encrypted));

    expect(result.format).toBe("encrypted-messagepack");
    expect(result.data.CultName).toBe(TEST_CULT_NAME);
    expect(result.data.UnlockedUpgrades).toEqual(
      RITUAL_OF_RESURRECTION.upgradeIds,
    );
    expect(result.data.DoctrineUnlockedUpgrades).toEqual([
      RITUAL_OF_RESURRECTION.doctrineId,
    ]);
    expect(result.data.CultTraits).toEqual(
      BELIEF_IN_SACRIFICE.cultTraitIds,
    );
    expect(result.data[String(UNKNOWN_SLOT_POSITION)]).toEqual([]);
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
    const lengthHeader = concatenateBytes(
      blocks.map((block) => encode(block.byteLength)),
    );
    const outerMessage = encode([
      new ExtData(MESSAGEPACK_LZ4_EXTENSION, lengthHeader),
      ...compressed,
    ]);
    const encrypted = await encryptPayload(outerMessage, {
      key: TEST_AES_KEY,
      iv: TEST_AES_IV,
    });

    const result = await decodeSave(exactBuffer(encrypted));

    expect(result.format).toBe("encrypted-messagepack");
    expect(result.data.CultName).toBe(TEST_CULT_NAME);
    expect(result.data.DoctrineUnlockedUpgrades).toEqual([
      RITUAL_OF_RESURRECTION.doctrineId,
    ]);
    expect(result.data[String(UNKNOWN_SLOT_POSITION)]).toEqual([]);

    if (!result.messagePack) {
      throw new Error("Expected raw MessagePack source data.");
    }
    expect(result.messagePack.compression?.blockSizes).toEqual(
      blocks.map((block) => block.byteLength),
    );
    expect(result.messagePack.rawPayload).toEqual(innerMessage);

    const rewritten = await encodeVerifiedMessagePackSave(result.messagePack, {
      key: TEST_AES_KEY,
      iv: TEST_AES_IV,
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
        key: TEST_AES_KEY,
        iv: TEST_AES_IV,
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

  it("rejects an empty file", async () => {
    await expect(
      decodeSave(exactBuffer(new Uint8Array())),
    ).rejects.toThrow("empty");
  });

  it("rejects a truncated encrypted save", async () => {
    const encrypted = await encryptPayload(encode(makePositionalSave()), {
      key: TEST_AES_KEY,
      iv: TEST_AES_IV,
    });
    const truncated = encrypted.slice(0, encrypted.byteLength - 100);

    await expect(decodeSave(exactBuffer(truncated))).rejects.toBeInstanceOf(
      SaveDecodeError,
    );
  });

  it("rejects a meta.mp file with a clear message", async () => {
    const encrypted = await encryptPayload(
      encode(Array.from<unknown>({ length: 10 }).fill(null)),
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );

    await expect(decodeSave(exactBuffer(encrypted))).rejects.toThrow(
      "not a campaign slot",
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
      CultTrait: BELIEF_IN_SACRIFICE.cultTraitIds,
    });

    expect(report.canEditDoctrines).toBe(true);
    expect(report.doctrineFields.cultTraitsField).toBe("CultTrait");
  });

  it("keeps unknown positions visible without hiding doctrine controls", () => {
    const unknownKey = String(UNKNOWN_SLOT_POSITION);
    const report = analyzeSave({ ...sampleSave, [unknownKey]: true });

    expect(report.canEditDoctrines).toBe(true);
    expect(report.unknownTopLevelKeys).toEqual([unknownKey]);
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
