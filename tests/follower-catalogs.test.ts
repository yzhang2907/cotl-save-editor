import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { decodeSave } from "../src/save/decode";
import {
  catalogName,
  FOLLOWER_CLOTHING,
  FOLLOWER_HATS,
  FOLLOWER_OUTFITS,
  FOLLOWER_ROLES,
  FOLLOWER_TRAITS,
} from "../src/save/follower-catalogs";

const saveCopyPath = process.env.COTL_SAVE_COPY;
const describeSaveCopy = saveCopyPath ? describe : describe.skip;

describe("follower catalogs", () => {
  it("keeps the anchor ids the extractor was built against", () => {
    expect(FOLLOWER_TRAITS[6]).toEqual({
      key: "GrassEater",
      name: "Grass Eater",
    });
    expect(FOLLOWER_ROLES[3]?.key).toBe("Farmer");
    expect(FOLLOWER_HATS[0]?.key).toBe("None");
  });

  it("names every entry", () => {
    for (const catalog of [
      FOLLOWER_TRAITS,
      FOLLOWER_ROLES,
      FOLLOWER_HATS,
      FOLLOWER_OUTFITS,
      FOLLOWER_CLOTHING,
    ]) {
      for (const entry of Object.values(catalog)) {
        expect(entry.name).not.toBe("");
      }
    }
  });

  it("degrades to an unknown label", () => {
    expect(catalogName(FOLLOWER_TRAITS, 9999, "trait")).toBe(
      "Unknown trait 9999",
    );
  });
});

describeSaveCopy("follower catalogs against the real save", () => {
  interface FollowerRecord {
    Outfit?: unknown;
    SkinCharacter?: unknown;
    SkinName?: unknown;
    Traits?: unknown;
  }

  async function readFollowers(): Promise<FollowerRecord[]> {
    if (!saveCopyPath) {
      throw new Error("COTL_SAVE_COPY is not set.");
    }
    const bytes = new Uint8Array(await readFile(saveCopyPath));
    const decoded = await decodeSave(bytes.slice().buffer);
    const data = decoded.data as Record<string, unknown>;
    return [
      "Followers",
      "Followers_Recruit",
      "Followers_Dead",
      "Followers_Possessed",
      "Followers_Dissented",
    ].flatMap((key) =>
      Array.isArray(data[key]) ? (data[key] as FollowerRecord[]) : [],
    );
  }

  it("knows every trait carried by a follower", async () => {
    for (const follower of await readFollowers()) {
      for (const trait of Array.isArray(follower.Traits)
        ? follower.Traits
        : []) {
        expect(FOLLOWER_TRAITS[trait as number]).toBeDefined();
      }
    }
  });

  it("knows every worn outfit", async () => {
    for (const follower of await readFollowers()) {
      if (typeof follower.Outfit === "number") {
        expect(FOLLOWER_OUTFITS[follower.Outfit]).toBeDefined();
      }
    }
  });

  it("sees SkinCharacter map 1:1 onto the base SkinName", async () => {
    // "Seahorse3" is base skin "Seahorse" at variation 2: the trailing
    // digits are the variation plus one, not part of the skin identity.
    const skins = new Map<number, string>();
    for (const follower of await readFollowers()) {
      if (
        typeof follower.SkinCharacter !== "number" ||
        typeof follower.SkinName !== "string"
      ) {
        continue;
      }
      const base = follower.SkinName.replace(/\d+$/, "");
      const known = skins.get(follower.SkinCharacter);
      if (known === undefined) {
        skins.set(follower.SkinCharacter, base);
      } else {
        expect(known).toBe(base);
      }
    }
    expect(skins.size).toBeGreaterThan(0);
  });
});
