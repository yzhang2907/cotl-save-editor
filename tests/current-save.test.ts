import { encode } from "@msgpack/msgpack";
import { describe, expect, it } from "vitest";

import {
  applyCultEdits,
  emptyCultEdits,
  stageCultNameEdit,
  stageResourceAddition,
  stageResourceEdit,
} from "../src/save/cult-edits";
import {
  CURRENT_DOCTRINE_FIELD_POSITIONS,
  CurrentSaveWriteError,
  encodeVerifiedModifiedCurrentSave,
} from "../src/save/current-save";
import { decodeSave } from "../src/save/decode";
import { planDoctrineChange } from "../src/save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
} from "../src/save/doctrine-workspace";
import {
  decodeMessagePackPayload,
  messagePackFieldPosition,
  replaceMessagePackPositions,
  verifyMessagePackPositions,
} from "../src/save/messagepack";
import type { MessagePackSource } from "../src/save/types";
import {
  ASCEND_FOLLOWER,
  BELIEF_IN_AFTERLIFE,
  FAITHFUL,
  FUNERAL,
  GLORY_OF_CONSTRUCTION,
  HOLY_DAY_RITUAL,
  INDUSTRIOUS,
  INSPIRE,
  MURDER_FOLLOWER,
  PRESERVED_SPECIAL_DOCTRINE_ID,
  PRESERVED_TRAIT_ID,
  PRESERVED_UPGRADE_ID,
  RITUAL_OF_RESURRECTION,
  STANDARD_DOCTRINE_IDS,
  STANDARD_TRAIT_IDS,
  STANDARD_UPGRADE_IDS,
} from "./doctrine-fixtures";
import {
  concatenateBytes,
  EMPTY_MESSAGEPACK_ARRAY_BYTE,
  exactBuffer,
  requiredSlotPosition,
  SLOT_POSITION_COUNT,
  TEST_AES_IV,
  TEST_AES_KEY,
  TEST_CULT_NAME,
  TEST_FIRST_LZ4_BLOCK_BYTES,
  UNKNOWN_CATALOG_ID,
  UNKNOWN_SLOT_POSITION,
} from "./save-fixtures";

const numericKeyMap = Uint8Array.of(
  0x81,
  0x01,
  0xa3,
  0x6f,
  0x6e,
  0x65,
);

async function currentSource(options: {
  cultTraits?: number[];
  doctrineIds?: number[];
  items?: unknown[];
  postgameDualChoice?: boolean;
  upgradeIds?: number[];
} = {}): Promise<{
  original: Record<string, unknown>;
  source: MessagePackSource;
}> {
  const rawData = Array.from<unknown>({
    length: SLOT_POSITION_COUNT,
  }).fill(null);
  rawData[CURRENT_DOCTRINE_FIELD_POSITIONS.UnlockedUpgrades] =
    options.upgradeIds ?? STANDARD_UPGRADE_IDS;
  rawData[CURRENT_DOCTRINE_FIELD_POSITIONS.DoctrineUnlockedUpgrades] =
    options.doctrineIds ??
    (options.postgameDualChoice
      ? [
          FAITHFUL.doctrineId,
          INDUSTRIOUS.doctrineId,
          FUNERAL.doctrineId,
          PRESERVED_SPECIAL_DOCTRINE_ID,
        ]
      : STANDARD_DOCTRINE_IDS);
  rawData[CURRENT_DOCTRINE_FIELD_POSITIONS.CultTraits] =
    options.cultTraits ??
    (options.postgameDualChoice
      ? [
          ...FAITHFUL.cultTraitIds,
          ...INDUSTRIOUS.cultTraitIds,
          ...BELIEF_IN_AFTERLIFE.cultTraitIds,
          PRESERVED_TRAIT_ID,
        ]
      : STANDARD_TRAIT_IDS);
  rawData[requiredSlotPosition("CultName")] = TEST_CULT_NAME;
  if (options.items !== undefined) {
    rawData[requiredSlotPosition("items")] = options.items;
  }
  rawData[UNKNOWN_SLOT_POSITION] = [];

  const ordinaryPayload = encode(rawData, { useBigInt64: true });
  expect(ordinaryPayload.at(-1)).toBe(EMPTY_MESSAGEPACK_ARRAY_BYTE);
  const payload = concatenateBytes([
    ordinaryPayload.slice(0, -1),
    numericKeyMap,
  ]);
  const decoded = await decodeMessagePackPayload(payload);
  decoded.source.compression = {
    blockSizes: [
      TEST_FIRST_LZ4_BLOCK_BYTES,
      payload.byteLength - TEST_FIRST_LZ4_BLOCK_BYTES,
    ],
  };
  return {
    original: decoded.data,
    source: decoded.source,
  };
}

function changedWorkingCopy(original: Record<string, unknown>) {
  const workChange = applyDoctrineChange(
    createDoctrineWorkspace(original),
    planDoctrineChange(original, INDUSTRIOUS.doctrineId),
  );
  return applyDoctrineChange(
    workChange,
    planDoctrineChange(
      workChange.data,
      RITUAL_OF_RESURRECTION.doctrineId,
    ),
  ).data;
}

describe("modified current save writer", () => {
  it("maps every current doctrine field to its supported raw position", () => {
    for (
      const [field, position] of Object.entries(
        CURRENT_DOCTRINE_FIELD_POSITIONS,
      )
    ) {
      expect(messagePackFieldPosition("slot", field)).toBe(position);
    }
    expect(messagePackFieldPosition("slot", "CultTrait")).toBeNull();
  });

  it("writes, encrypts, reopens, and verifies only planned positions", async () => {
    const { original, source } = await currentSource();
    const sourceDataSnapshot = structuredClone(source.rawData);
    const sourcePayloadSnapshot = source.rawPayload.slice();
    const working = changedWorkingCopy(original);

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.format).toBe("encrypted-messagepack");
    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual([
      INDUSTRIOUS.doctrineId,
      RITUAL_OF_RESURRECTION.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);
    expect(reopened.data.CultTraits).toEqual([
      ...INDUSTRIOUS.cultTraitIds,
      ...BELIEF_IN_AFTERLIFE.cultTraitIds,
      PRESERVED_TRAIT_ID,
    ]);
    expect(reopened.data.UnlockedUpgrades).toEqual([
      ...RITUAL_OF_RESURRECTION.upgradeIds,
      PRESERVED_UPGRADE_ID,
      UNKNOWN_CATALOG_ID,
    ]);
    expect(reopened.data.CultName).toBe(TEST_CULT_NAME);
    expect(reopened.data[String(UNKNOWN_SLOT_POSITION)]).toEqual({
      "1": "one",
    });
    expect(reopened.messagePack?.compression?.blockSizes).toEqual([
      TEST_FIRST_LZ4_BLOCK_BYTES,
      expect.any(Number),
    ]);
    expect(
      reopened.messagePack?.rawPayload.slice(-numericKeyMap.byteLength),
    ).toEqual(numericKeyMap);
    expect(source.rawData).toEqual(sourceDataSnapshot);
    expect(source.rawPayload).toEqual(sourcePayloadSnapshot);
  });

  it("preserves legitimate opposing doctrines while changing another rank", async () => {
    const { original, source } = await currentSource({
      postgameDualChoice: true,
    });
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, RITUAL_OF_RESURRECTION.doctrineId),
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      workspace.data,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual([
      FAITHFUL.doctrineId,
      INDUSTRIOUS.doctrineId,
      RITUAL_OF_RESURRECTION.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);
    expect(reopened.data.CultTraits).toEqual([
      ...FAITHFUL.cultTraitIds,
      ...INDUSTRIOUS.cultTraitIds,
      ...BELIEF_IN_AFTERLIFE.cultTraitIds,
      PRESERVED_TRAIT_ID,
    ]);
    expect(reopened.data.UnlockedUpgrades).toEqual([
      ...RITUAL_OF_RESURRECTION.upgradeIds,
      PRESERVED_UPGRADE_ID,
      UNKNOWN_CATALOG_ID,
    ]);
  });

  it("writes and reopens a missing fourth-tier unlock", async () => {
    const { original, source } = await currentSource({
      cultTraits: FAITHFUL.cultTraitIds,
      doctrineIds: [
        FAITHFUL.doctrineId,
        INSPIRE.doctrineId,
        GLORY_OF_CONSTRUCTION.doctrineId,
      ],
      upgradeIds: GLORY_OF_CONSTRUCTION.upgradeIds,
    });
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, HOLY_DAY_RITUAL.doctrineId),
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      workspace.data,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual([
      FAITHFUL.doctrineId,
      INSPIRE.doctrineId,
      GLORY_OF_CONSTRUCTION.doctrineId,
      HOLY_DAY_RITUAL.doctrineId,
    ]);
    expect(reopened.data.CultTraits).toEqual(FAITHFUL.cultTraitIds);
    expect(reopened.data.UnlockedUpgrades).toEqual([
      ...GLORY_OF_CONSTRUCTION.upgradeIds,
      ...HOLY_DAY_RITUAL.upgradeIds,
    ]);
    expect(
      reopened.messagePack?.rawPayload.slice(-numericKeyMap.byteLength),
    ).toEqual(numericKeyMap);
  });

  it("preserves untouched spans when an edited array changes byte length", async () => {
    const { original, source } = await currentSource({
      cultTraits: [PRESERVED_TRAIT_ID],
      doctrineIds: [
        MURDER_FOLLOWER.doctrineId,
        PRESERVED_SPECIAL_DOCTRINE_ID,
      ],
      upgradeIds: [PRESERVED_UPGRADE_ID, UNKNOWN_CATALOG_ID],
    });
    const workspace = applyDoctrineChange(
      createDoctrineWorkspace(original),
      planDoctrineChange(original, ASCEND_FOLLOWER.doctrineId),
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      workspace.data,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual([
      ASCEND_FOLLOWER.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);
    expect(reopened.data.CultTraits).toEqual([PRESERVED_TRAIT_ID]);
    expect(reopened.data.UnlockedUpgrades).toEqual([
      PRESERVED_UPGRADE_ID,
      UNKNOWN_CATALOG_ID,
      ...ASCEND_FOLLOWER.upgradeIds,
    ]);
    expect(reopened.messagePack?.rawPayload.byteLength).toBeGreaterThan(
      source.rawPayload.byteLength,
    );
    expect(
      reopened.messagePack?.rawPayload.slice(-numericKeyMap.byteLength),
    ).toEqual(numericKeyMap);
  });

  it("writes a rename and inventory quantities alongside doctrines", async () => {
    const RAW_ITEMS = [
      [20, 123, 5],
      [154, 4, 0],
      [33, 9, 2, "unmapped"],
    ];
    const { original, source } = await currentSource({
      items: RAW_ITEMS,
    });
    let edits = stageCultNameEdit(
      original,
      emptyCultEdits(),
      "Chosen of the Isopod",
    );
    edits = stageResourceEdit(original, edits, {
      quantity: 400,
      reserved: 2,
      type: 20,
    });
    const working = applyCultEdits(
      changedWorkingCopy(original),
      original,
      edits,
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.data.CultName).toBe("Chosen of the Isopod");
    expect(reopened.data.items).toEqual([
      { QuantityReserved: 2, quantity: 400, type: 20 },
      { QuantityReserved: 0, quantity: 4, type: 154 },
      { "3": "unmapped", QuantityReserved: 2, quantity: 9, type: 33 },
    ]);
    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual([
      INDUSTRIOUS.doctrineId,
      RITUAL_OF_RESURRECTION.doctrineId,
      PRESERVED_SPECIAL_DOCTRINE_ID,
    ]);
    expect(reopened.data[String(UNKNOWN_SLOT_POSITION)]).toEqual({
      "1": "one",
    });
  });

  it("writes only a rename when nothing else changed", async () => {
    const { original, source } = await currentSource();
    const working = applyCultEdits(
      original,
      original,
      stageCultNameEdit(original, emptyCultEdits(), "Renamed Flock"),
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.data.CultName).toBe("Renamed Flock");
    expect(reopened.data.DoctrineUnlockedUpgrades).toEqual(
      original.DoctrineUnlockedUpgrades,
    );
  });

  it("stops when the working copy changes an unapproved inventory field", async () => {
    const { original, source } = await currentSource({
      items: [[20, 123, 5]],
    });
    const items = (original.items as Array<Record<string, unknown>>).map(
      (entry) => ({ ...entry }),
    );
    const firstItem = items[0] as Record<string, unknown>;
    firstItem.type = 21;
    const working = { ...original, items };

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow("unapproved inventory field type");
  });

  it("writes an added catalog item as a new raw inventory entry", async () => {
    const { original, source } = await currentSource({
      items: [[20, 123, 5]],
    });
    const working = applyCultEdits(
      original,
      original,
      stageResourceAddition(original, emptyCultEdits(), {
        quantity: 250,
        reserved: 0,
        type: 2,
      }),
    );

    const written = await encodeVerifiedModifiedCurrentSave(
      source,
      original,
      working,
      { key: TEST_AES_KEY, iv: TEST_AES_IV },
    );
    const reopened = await decodeSave(exactBuffer(written));

    expect(reopened.data.items).toEqual([
      { QuantityReserved: 5, quantity: 123, type: 20 },
      { QuantityReserved: 0, quantity: 250, type: 2 },
    ]);
    expect(reopened.data[String(UNKNOWN_SLOT_POSITION)]).toEqual({
      "1": "one",
    });
  });

  it("stops when the working copy removes an inventory entry", async () => {
    const { original, source } = await currentSource({
      items: [
        [20, 123, 5],
        [154, 4, 0],
      ],
    });
    const working = {
      ...original,
      items: (original.items as unknown[]).slice(0, 1),
    };

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow("changed the number of inventory entries");
  });

  it("stops when an appended entry duplicates an item type", async () => {
    const { original, source } = await currentSource({
      items: [[20, 123, 5]],
    });
    const working = {
      ...original,
      items: [
        ...(original.items as unknown[]),
        { type: 20, quantity: 1, QuantityReserved: 0 },
      ],
    };

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow("duplicates or mislabels an item type");
  });

  it("stops when an appended entry has an unexpected layout", async () => {
    const { original, source } = await currentSource({
      items: [[20, 123, 5]],
    });
    const working = {
      ...original,
      items: [
        ...(original.items as unknown[]),
        { QuantityReserved: 0, quantity: 1, type: 2 },
      ],
    };

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow("[type, quantity, QuantityReserved] layout");
  });

  it("stops when the working copy changes an unapproved field", async () => {
    const { original, source } = await currentSource();
    const working = {
      ...changedWorkingCopy(original),
      [String(UNKNOWN_SLOT_POSITION)]: { "1": "tampered" },
    };

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow(
      `changed unapproved field ${UNKNOWN_SLOT_POSITION}`,
    );
  });

  it("stops when a named field no longer matches its raw position", async () => {
    const { original, source } = await currentSource();
    const working = changedWorkingCopy(original);
    source.rawData[
      CURRENT_DOCTRINE_FIELD_POSITIONS.DoctrineUnlockedUpgrades
    ] = [UNKNOWN_CATALOG_ID];

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow(CurrentSaveWriteError);
    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, working),
    ).rejects.toThrow(
      `no longer matches raw MessagePack position ${CURRENT_DOCTRINE_FIELD_POSITIONS.DoctrineUnlockedUpgrades}`,
    );
  });

  it("stops when any unapproved raw position differs after writing", async () => {
    const { source } = await currentSource();
    const approved = new Map<number, unknown>([
      [
        CURRENT_DOCTRINE_FIELD_POSITIONS.DoctrineUnlockedUpgrades,
        STANDARD_DOCTRINE_IDS,
      ],
    ]);
    const cultNamePosition = requiredSlotPosition("CultName");
    const tampered = replaceMessagePackPositions(
      source,
      new Map<number, unknown>([
        ...approved,
        [cultNamePosition, "Tampered Flock"],
      ]),
    );

    expect(() =>
      verifyMessagePackPositions(source, tampered, approved),
    ).toThrow(`changed unapproved position ${cultNamePosition}`);
  });

  it("does not invoke the current writer for an unchanged working copy", async () => {
    const { original, source } = await currentSource();

    await expect(
      encodeVerifiedModifiedCurrentSave(source, original, original),
    ).rejects.toThrow("There are no current-save changes to write");
  });
});
