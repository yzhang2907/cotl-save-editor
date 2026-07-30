import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { analyzeSave } from "../src/save/analyze";
import { decodeSave } from "../src/save/decode";
import { encodeVerifiedMessagePackSave } from "../src/save/encode";

const saveCopyPath = process.env.COTL_SAVE_COPY;
const describeSaveCopy = saveCopyPath ? describe : describe.skip;

describeSaveCopy("real save copy", () => {
  it("keeps all data through an encrypted MP round trip", async () => {
    const input = new Uint8Array(
      await readFile(saveCopyPath as string),
    );
    const decoded = await decodeSave(input.slice().buffer);

    expect(decoded.format).toBe("encrypted-messagepack");
    if (!decoded.messagePack) {
      throw new Error("Expected raw MessagePack source data.");
    }
    expect(decoded.messagePack.schema).toBe("slot");
    const report = analyzeSave(decoded.data);
    expect(report.fieldCount).toBeGreaterThan(1_000);
    expect(report.doctrineFields.doctrineUnlockCount).not.toBeNull();
    expect(report.doctrineFields.unlockedUpgradeCount).not.toBeNull();
    expect(report.doctrineFields.cultTraitsCount).not.toBeNull();

    const rewritten = await encodeVerifiedMessagePackSave(
      decoded.messagePack,
    );
    const roundTrip = await decodeSave(rewritten.slice().buffer);

    expect(roundTrip.data).toEqual(decoded.data);
    expect(roundTrip.messagePack?.rawData).toEqual(
      decoded.messagePack.rawData,
    );
    expect(roundTrip.messagePack?.rawPayload).toEqual(
      decoded.messagePack.rawPayload,
    );
    expect(
      roundTrip.messagePack?.compression?.blockSizes.every(
        (size) => size > 0,
      ),
    ).toBe(true);
  });
});
