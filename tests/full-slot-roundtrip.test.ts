import { encode } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";

import {
  applyCultEdits,
  emptyCultEdits,
  stageCultNameEdit,
  stageResourceEdit,
} from "../src/save/cult-edits";
import { encodeVerifiedModifiedCurrentSave } from "../src/save/current-save";
import { decodeSave } from "../src/save/decode";
import { encodeVerifiedMessagePackSave } from "../src/save/encode";
import {
  applyFollowerEdits,
  DEATH_CAUSE_FIELD,
  emptyFollowerEdits,
  stageFollowerEdit,
  STATUS_FIELD,
} from "../src/save/follower-edits";
import { decodeMessagePackPayload } from "../src/save/messagepack";
import { buildCultOverview } from "../src/save/overview";
import type { MessagePackSource, SaveRecord } from "../src/save/types";
import {
  STANDARD_DOCTRINE_IDS,
  STANDARD_TRAIT_IDS,
  STANDARD_UPGRADE_IDS,
} from "./doctrine-fixtures";
import {
  exactBuffer,
  rawFollower,
  rawFollowerIn,
  representativeSlotSave,
  requiredSlotPosition,
  SLOT_POSITION_COUNT,
  TEST_AES_IV,
  TEST_AES_KEY,
  TEST_CULT_NAME,
} from "./save-fixtures";

const LIVING_EDIT_ID = 7;
const KILLED_ID = 9;
const REVIVED_ID = 21;

/*
 * The private-copy round-trip suite only runs where a real save is
 * available, so this synthetic full-size slot keeps the same paths
 * covered on every run: all mapped positions populated, a payload
 * spanning several LZ4 blocks, and edits that move followers between
 * both list layouts.
 */
async function fullSlotSource(): Promise<{
  original: SaveRecord;
  source: MessagePackSource;
}> {
  const rawData = representativeSlotSave({
    CultName: TEST_CULT_NAME,
    CultTraits: STANDARD_TRAIT_IDS.slice(),
    DoctrineUnlockedUpgrades: STANDARD_DOCTRINE_IDS.slice(),
    Followers: [
      rawFollower({
        Age: 20,
        Hat: 0,
        ID: LIVING_EDIT_ID,
        Necklace: 47,
        Outfit: 7,
        Traits: [6, 16],
        XPLevel: 3,
        _happiness: 60,
        _name: "Webb",
        _satiation: 80,
      }),
      rawFollower({
        Age: 44,
        ID: KILLED_ID,
        Traits: [2],
        XPLevel: 1,
        _name: "Mola",
      }),
    ],
    Followers_Dead: [
      rawFollowerIn("Followers_Dead", {
        Age: 60,
        DiedOfOldAge: true,
        ID: REVIVED_ID,
        LifeExpectancy: 80,
        OldAge: true,
        _name: "Boo",
      }),
    ],
    Followers_Dead_IDs: [REVIVED_ID],
    Followers_Elderly_IDs: [REVIVED_ID],
    UnlockedUpgrades: STANDARD_UPGRADE_IDS.slice(),
    items: [
      [20, 123, 5],
      [154, 4, 0],
    ],
  });

  const decoded = await decodeMessagePackPayload(
    encode(rawData, { useBigInt64: true }),
  );
  // An empty preferred list makes the encoder split with its default
  // block sizes, the way a save first written by the game is split.
  decoded.source.compression = { blockSizes: [] };
  return { original: decoded.data, source: decoded.source };
}

describe("full synthetic slot round trip", () => {
  it("rebuilds the full slot unchanged across several LZ4 blocks", async () => {
    const { original, source } = await fullSlotSource();

    expect(source.schema).toBe("slot");
    expect(source.rawData).toHaveLength(SLOT_POSITION_COUNT);

    const rewritten = await encodeVerifiedMessagePackSave(source, {
      iv: TEST_AES_IV,
      key: TEST_AES_KEY,
    });
    const roundTrip = await decodeSave(exactBuffer(rewritten));

    expect(roundTrip.format).toBe("encrypted-messagepack");
    expect(roundTrip.data).toEqual(original);
    expect(roundTrip.messagePack?.rawPayload).toEqual(source.rawPayload);
    const blockSizes = roundTrip.messagePack?.compression?.blockSizes ?? [];
    expect(blockSizes.length).toBeGreaterThanOrEqual(3);
    expect(blockSizes.every((size) => size > 0)).toBe(true);

    const overview = buildCultOverview(roundTrip.data);
    expect(overview.identity.name).toBe(TEST_CULT_NAME);
    expect(overview.followerCount).toBe(2);
  });

  it("writes edits into the full slot and reopens them intact", async () => {
    const { original, source } = await fullSlotSource();

    let cultEdits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "Chosen of the Isopod",
    );
    cultEdits = stageResourceEdit(original, cultEdits, {
      quantity: 400,
      reserved: 2,
      type: 20,
    });
    let followerEdits = stageFollowerEdit(original, emptyFollowerEdits(), {
      field: "XPLevel",
      followerId: LIVING_EDIT_ID,
      value: 10,
    });
    followerEdits = stageFollowerEdit(original, followerEdits, {
      field: "_name",
      followerId: LIVING_EDIT_ID,
      value: "Webbington",
    });
    followerEdits = stageFollowerEdit(original, followerEdits, {
      field: STATUS_FIELD,
      followerId: KILLED_ID,
      value: "Dead",
    });
    followerEdits = stageFollowerEdit(original, followerEdits, {
      field: DEATH_CAUSE_FIELD,
      followerId: KILLED_ID,
      value: "DiedFromMurder",
    });
    followerEdits = stageFollowerEdit(original, followerEdits, {
      field: STATUS_FIELD,
      followerId: REVIVED_ID,
      value: "Elder",
    });
    const working = applyFollowerEdits(
      applyCultEdits(original, original, cultEdits),
      original,
      followerEdits,
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
      { iv: TEST_AES_IV, key: TEST_AES_KEY },
    );
    const reopened = await decodeSave(exactBuffer(written));
    const living = reopened.data.Followers as SaveRecord[];
    const dead = reopened.data.Followers_Dead as SaveRecord[];

    expect(reopened.data.CultName).toBe("Chosen of the Isopod");
    expect(reopened.data.items).toEqual([
      { QuantityReserved: 2, quantity: 400, type: 20 },
      { QuantityReserved: 0, quantity: 4, type: 154 },
    ]);

    expect(living.map((entry) => entry.ID)).toEqual([
      LIVING_EDIT_ID,
      REVIVED_ID,
    ]);
    expect(living[0]).toMatchObject({
      XPLevel: 10,
      _name: "Webbington",
    });
    expect(living[0]?.Age).toBe(20);

    const revived = living.at(-1);
    expect(revived?._name).toBe("Boo");
    expect(revived?.OldAge).toBe(true);
    expect(revived?.DiedOfOldAge).toBe(false);
    // An Elder revive pulls the lifespan down to the age so the next
    // day tick keeps the follower elder.
    expect(revived?.LifeExpectancy).toBe(60);

    expect(dead.map((entry) => entry.ID)).toEqual([KILLED_ID]);
    expect(dead[0]?._name).toBe("Mola");
    expect(dead[0]?.DiedFromMurder).toBe(true);
    expect(dead[0]?.DiedOfOldAge).toBe(false);
    expect(reopened.data.Followers_Dead_IDs).toEqual([KILLED_ID]);
    expect(reopened.data.Followers_Elderly_IDs).toEqual([REVIVED_ID]);

    // Every position outside the approved edits survives byte-for-byte.
    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual(
      STANDARD_DOCTRINE_IDS,
    );
    expect(reopened.data.CultTraits).toEqual(STANDARD_TRAIT_IDS);
    expect(reopened.data.UnlockedUpgrades).toEqual(STANDARD_UPGRADE_IDS);
    const renamedPosition = requiredSlotPosition("CultName");
    const untouched = source.rawData
      .map((value, position) => ({ position, value }))
      .filter(
        ({ position, value }) =>
          typeof value === "string" && position !== renamedPosition,
      );
    expect(untouched.length).toBeGreaterThan(100);
    for (const { position, value } of untouched) {
      expect(reopened.messagePack?.rawData[position]).toEqual(value);
    }
  });
});
