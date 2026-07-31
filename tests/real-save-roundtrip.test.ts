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
const describeSaveCopy = saveCopyPath ? describe : describe.skip;

async function readSaveCopy(path: string): Promise<ArrayBuffer> {
  return new Uint8Array(await readFile(path)).slice().buffer;
}

describeSaveCopy("real save copy", () => {
  it("keeps all data through an encrypted MP round trip", async () => {
    const decoded = await decodeSave(
      await readSaveCopy(saveCopyPath as string),
    );

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
    expect(overview.identity.name).toBeTruthy();
    expect(overview.identity.day).not.toBeNull();
    expect(overview.followerCount).toBeGreaterThan(0);
    expect(overview.structureCount).toBeGreaterThan(0);
    expect(overview.itemTypeCount).toBeGreaterThan(0);
    expect(overview.resources.every((resource) => resource.known)).toBe(true);
    expect(overview.doctrine.unknownIds).toEqual([]);
    expect(overview.rituals.length).toBeGreaterThan(0);
    expect(overview.sermonsAndRites.length).toBeGreaterThan(0);
    expect(
      overview.doctrine.categories.some(
        (category) => category.selectedCount > 0,
      ),
    ).toBe(true);

    const doctrineAssessment = assessDoctrineEditing(decoded.data);
    expect(doctrineAssessment.blockers).toEqual([]);
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
