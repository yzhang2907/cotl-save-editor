import { encode } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";

import { encodeVerifiedModifiedCurrentSave } from "../src/save/current-save";
import { decodeSave } from "../src/save/decode";
import {
  FOLLOWER_CLOTHING,
  FOLLOWER_CUSTOMISATIONS,
  FOLLOWER_HATS,
  FOLLOWER_OUTFITS,
  FOLLOWER_SPECIALS,
  type FollowerCatalog,
} from "../src/save/follower-catalogs";
import {
  applyFollowerEdits,
  DEATH_CAUSE_FIELD,
  emptyFollowerEdits,
  FOLLOWER_FIELD_NAMES,
  stageFollowerEdit,
  STATUS_FIELD,
} from "../src/save/follower-edits";
import { decodeMessagePackPayload } from "../src/save/messagepack";
import { DEATH_CAUSES } from "../src/save/overview";
import type { MessagePackSource, SaveRecord } from "../src/save/types";
import {
  exactBuffer,
  rawFollower,
  rawFollowerIn,
  requiredSlotPosition,
  SLOT_POSITION_COUNT,
  TEST_CULT_NAME,
  UNKNOWN_SLOT_POSITION,
} from "./save-fixtures";

const LIVING_ID = 7;
const DEAD_ID = 21;

function firstCatalogId(catalog: FollowerCatalog): number {
  const first = Object.keys(catalog)[0];
  if (first === undefined) {
    throw new Error("The follower catalog has no entries.");
  }
  return Number(first);
}

/*
 * One valid, changed value per stageable field. The paired assertion on
 * FOLLOWER_FIELD_NAMES keeps this table in lockstep with the staging
 * allowlist, so a field added there without writer approval fails the
 * write below instead of surfacing at download time.
 */
const STAGED_VALUES: Readonly<Record<string, unknown>> = {
  Age: 33,
  Clothing: firstCatalogId(FOLLOWER_CLOTHING),
  ClothingPreviousVariant: "Variant_A",
  ClothingVariant: "Variant_B",
  Customisation: firstCatalogId(FOLLOWER_CUSTOMISATIONS),
  Hat: firstCatalogId(FOLLOWER_HATS),
  LifeExpectancy: 90,
  Necklace: 0,
  Outfit: firstCatalogId(FOLLOWER_OUTFITS),
  ShowingNecklace: true,
  SkinColour: 3,
  SkinVariation: 1,
  Special: firstCatalogId(FOLLOWER_SPECIALS),
  Traits: [6],
  XPLevel: 8,
  _happiness: 55.5,
  _illness: 12,
  _name: "Webbington",
  _satiation: 42.25,
};

async function followerSource(
  options: {
    deadIds?: number[];
    elderlyIds?: number[];
    followers?: unknown[];
    followersDead?: unknown[];
  } = {},
): Promise<{ original: SaveRecord; source: MessagePackSource }> {
  const rawData = Array.from<unknown>({
    length: SLOT_POSITION_COUNT,
  }).fill(null);
  rawData[requiredSlotPosition("DoctrineUnlockedUpgrades")] = [];
  rawData[requiredSlotPosition("CultTraits")] = [];
  rawData[requiredSlotPosition("UnlockedUpgrades")] = [];
  rawData[requiredSlotPosition("CultName")] = TEST_CULT_NAME;
  rawData[requiredSlotPosition("Followers")] = options.followers ?? [
    rawFollower({ ID: LIVING_ID, _name: "Webb" }),
  ];
  rawData[requiredSlotPosition("Followers_Dead")] =
    options.followersDead ?? [];
  rawData[requiredSlotPosition("Followers_Dead_IDs")] =
    options.deadIds ?? [];
  rawData[requiredSlotPosition("Followers_Elderly_IDs")] =
    options.elderlyIds ?? [];
  rawData[UNKNOWN_SLOT_POSITION] = [];

  const decoded = await decodeMessagePackPayload(
    encode(rawData, { useBigInt64: true }),
  );
  return { original: decoded.data, source: decoded.source };
}

describe("follower staging and writer allowlist agreement", () => {
  it("writes every stageable follower field", async () => {
    // The value table and the exported staging list must cover exactly
    // the same fields, so a new stageable field forces a value here.
    expect(Object.keys(STAGED_VALUES).sort()).toEqual(
      [...FOLLOWER_FIELD_NAMES].sort(),
    );

    const { original, source } = await followerSource();
    let edits = emptyFollowerEdits();
    for (const field of FOLLOWER_FIELD_NAMES) {
      const value = STAGED_VALUES[field];
      if (value === undefined) {
        throw new Error(`Add a staged test value for ${field}.`);
      }
      edits = stageFollowerEdit(original, edits, {
        field,
        followerId: LIVING_ID,
        value,
      });
    }
    const working = applyFollowerEdits(original, original, edits);

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
    );
    const reopened = await decodeSave(exactBuffer(written));
    const follower = (reopened.data.Followers as SaveRecord[])[0];

    expect(follower).toBeDefined();
    for (const field of FOLLOWER_FIELD_NAMES) {
      expect(follower?.[field]).toEqual(STAGED_VALUES[field]);
    }
  });

  it.each(DEATH_CAUSES)(
    "writes a kill with the %s flag",
    async (flag) => {
      const { original, source } = await followerSource();
      let edits = stageFollowerEdit(original, emptyFollowerEdits(), {
        field: STATUS_FIELD,
        followerId: LIVING_ID,
        value: "Dead",
      });
      edits = stageFollowerEdit(original, edits, {
        field: DEATH_CAUSE_FIELD,
        followerId: LIVING_ID,
        value: flag,
      });
      const working = applyFollowerEdits(original, original, edits);

      const written = await encodeVerifiedModifiedCurrentSave(
        source,
        original,
        working,
      );
      const reopened = await decodeSave(exactBuffer(written));
      const killed = (reopened.data.Followers_Dead as SaveRecord[]).at(-1);

      expect(killed?.ID).toBe(LIVING_ID);
      for (const [candidate] of DEATH_CAUSES) {
        expect(killed?.[candidate]).toBe(candidate === flag);
      }
      expect(reopened.data.Followers_Dead_IDs).toEqual([LIVING_ID]);
    },
  );

  it("writes a ritual kill with every cause flag cleared", async () => {
    const { original, source } = await followerSource();
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: STATUS_FIELD,
      followerId: LIVING_ID,
      value: "Dead",
    });
    const working = applyFollowerEdits(original, original, edits);

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
    );
    const reopened = await decodeSave(exactBuffer(written));
    const killed = (reopened.data.Followers_Dead as SaveRecord[]).at(-1);

    expect(killed?.ID).toBe(LIVING_ID);
    for (const [candidate] of DEATH_CAUSES) {
      expect(killed?.[candidate]).toBe(false);
    }
  });

  it("aligns the lifespan with a revived status", async () => {
    const deadEntry = rawFollowerIn("Followers_Dead", {
      Age: 60,
      DiedOfOldAge: true,
      ID: DEAD_ID,
      LifeExpectancy: 60,
      OldAge: true,
      _name: "Boo",
    });
    const { original, source } = await followerSource({
      deadIds: [DEAD_ID],
      elderlyIds: [DEAD_ID],
      followersDead: [deadEntry],
    });
    const edits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: STATUS_FIELD,
      followerId: DEAD_ID,
      value: "Active",
    });
    const working = applyFollowerEdits(original, original, edits);

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
    );
    const reopened = await decodeSave(exactBuffer(written));
    const revived = (reopened.data.Followers as SaveRecord[]).at(-1);

    // An Active revive must leave LifeExpectancy above Age, or the game
    // would turn the follower elder again on the next day tick.
    expect(revived?.ID).toBe(DEAD_ID);
    expect(revived?.LifeExpectancy).toBe(75);
    expect(revived?.OldAge).toBe(false);
    expect(revived?.DiedOfOldAge).toBe(false);
    expect(reopened.data.Followers_Dead).toEqual([]);
    expect(reopened.data.Followers_Dead_IDs).toEqual([]);
    expect(reopened.data.Followers_Elderly_IDs).toEqual([]);
  });
});
