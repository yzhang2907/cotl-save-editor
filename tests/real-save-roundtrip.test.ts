import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { analyzeSave } from "../src/save/analyze";
import { decodeSave } from "../src/save/decode";
import {
  assessDoctrineEditing,
  planDoctrineChange,
} from "../src/save/doctrine-editor";
import { encodeVerifiedMessagePackSave } from "../src/save/encode";
import { buildCultOverview } from "../src/save/overview";

const saveCopyPath = process.env.COTL_SAVE_COPY;
const rebuiltSaveCopyPath = process.env.COTL_REBUILT_SAVE_COPY;
const newSaveCopyPath = process.env.COTL_NEW_SAVE_COPY;
const describeSaveCopy = saveCopyPath ? describe : describe.skip;
const describeNewSaveCopy = newSaveCopyPath ? describe : describe.skip;

async function readSaveCopy(path: string): Promise<ArrayBuffer> {
  return new Uint8Array(await readFile(path)).slice().buffer;
}

/**
 * Checks what every slot save must satisfy, whatever its progress, and
 * confirms that an unchanged rebuild keeps the raw bytes.
 */
async function checkSlotSave(path: string) {
  const decoded = await decodeSave(await readSaveCopy(path));

  expect(decoded.format).toBe("encrypted-messagepack");
  if (!decoded.messagePack) {
    throw new Error("Expected raw MessagePack source data.");
  }
  expect(decoded.messagePack.schema).toBe("slot");
  const report = analyzeSave(decoded.data);
  expect(report.doctrineFields.doctrineUnlockCount).not.toBeNull();
  expect(report.doctrineFields.unlockedUpgradeCount).not.toBeNull();
  expect(report.doctrineFields.cultTraitsCount).not.toBeNull();

  const overview = buildCultOverview(decoded.data);
  expect(overview.identity.day).not.toBeNull();
  expect(overview.resources.every((resource) => resource.known)).toBe(true);
  expect(overview.doctrine.unknownIds).toEqual([]);
  expect(assessDoctrineEditing(decoded.data).blockers).toEqual([]);

  const rewritten = await encodeVerifiedMessagePackSave(decoded.messagePack);
  const roundTrip = await decodeSave(rewritten.slice().buffer);

  expect(roundTrip.data).toEqual(decoded.data);
  expect(roundTrip.messagePack?.rawData).toEqual(decoded.messagePack.rawData);
  expect(roundTrip.messagePack?.rawPayload).toEqual(
    decoded.messagePack.rawPayload,
  );
  expect(
    roundTrip.messagePack?.compression?.blockSizes.every((size) => size > 0),
  ).toBe(true);

  return { decoded, overview };
}

describeSaveCopy("real save copy", () => {
  it("keeps all data through an encrypted MP round trip", async () => {
    const { decoded, overview } = await checkSlotSave(saveCopyPath as string);

    expect(overview.identity.name).toBeTruthy();
    expect(overview.followerCount).toBeGreaterThan(0);
    expect(overview.structureCount).toBeGreaterThan(0);
    expect(overview.itemTypeCount).toBeGreaterThan(0);
    expect(overview.rituals.length).toBeGreaterThan(0);
    expect(overview.sermonsAndRites.length).toBeGreaterThan(0);
    expect(
      overview.doctrine.categories.some(
        (category) => category.selectedCount > 0,
      ),
    ).toBe(true);

    const doctrinePlans = overview.doctrine.categories.flatMap((category) =>
      category.pairs.flatMap((pair) => {
        if (pair.selected.length !== 1) {
          return [];
        }
        const selected = pair.selected[0];
        const replacement = pair.choices.find(
          (choice) => choice.doctrineId !== selected?.doctrineId,
        );
        return replacement === undefined
          ? []
          : [planDoctrineChange(decoded.data, replacement.doctrineId)];
      }),
    );
    expect(doctrinePlans).toHaveLength(
      overview.doctrine.categories.reduce(
        (total, category) =>
          total +
          category.pairs.filter((pair) => pair.selected.length === 1).length,
        0,
      ),
    );
    expect(
      doctrinePlans.flatMap((plan) =>
        plan.state === "ready"
          ? []
          : [
              {
                blockers: plan.blockers,
                category: plan.categoryName,
                rank: plan.rank,
              },
            ],
      ),
    ).toEqual([]);
  });

  it.runIf(rebuiltSaveCopyPath)(
    "shows the same overview for the accepted unchanged rebuild",
    async () => {
      const source = await decodeSave(
        await readSaveCopy(saveCopyPath as string),
      );
      const rebuilt = await decodeSave(
        await readSaveCopy(rebuiltSaveCopyPath as string),
      );

      expect(buildCultOverview(rebuilt.data)).toEqual(
        buildCultOverview(source.data),
      );
    },
  );
});

describeNewSaveCopy("new campaign save copy", () => {
  it("reads and rebuilds a campaign with no progress", async () => {
    const { overview } = await checkSlotSave(newSaveCopyPath as string);

    // A campaign can be saved before the cult is named and before any
    // doctrine is chosen. Neither state may be treated as a bad save.
    expect(overview.doctrine.categories.every(
      (category) => category.selectedCount === 0,
    )).toBe(true);
  });
});
