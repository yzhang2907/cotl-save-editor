import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyFollowerEdits } from "../src/save/follower-edits";
import {
  clearCachedSession,
  readCachedSession,
  writeCachedSession,
  type CachedSession,
} from "../src/save/session-cache";

const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const SAVED_AT = 1_700_000_000_000;
const SAVE_BYTES = Uint8Array.of(69, 1, 2, 3);

function sampleSession(): CachedSession {
  return {
    bytes: SAVE_BYTES.slice().buffer,
    cultEdits: {
      additions: [],
      cultName: "Renamed Flock",
      resources: [{ quantity: 400, reserved: 2, type: 20 }],
    },
    doctrineHistory: [],
    fileName: "slot_0.mp",
    followerEdits: {
      fields: [{ field: "XPLevel", followerId: 7, value: 9 }],
    },
    lastModified: 1_699_999_999_000,
    savedAt: SAVED_AT,
  };
}

/** Stores a hand-built record, bypassing the CachedSession type. */
async function writeRawSession(record: unknown): Promise<void> {
  await writeCachedSession(record as CachedSession);
}

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("session cache", () => {
  it("returns null when nothing is cached", async () => {
    expect(await readCachedSession()).toBeNull();
  });

  it("round-trips a stored session", async () => {
    const session = sampleSession();
    vi.spyOn(Date, "now").mockReturnValue(SAVED_AT + 1000);

    await writeCachedSession(session);
    const restored = await readCachedSession();

    expect(restored).not.toBeNull();
    expect(new Uint8Array(restored?.bytes ?? new ArrayBuffer(0))).toEqual(
      SAVE_BYTES,
    );
    expect(restored?.fileName).toBe("slot_0.mp");
    expect(restored?.lastModified).toBe(session.lastModified);
    expect(restored?.cultEdits).toEqual(session.cultEdits);
    expect(restored?.followerEdits).toEqual(session.followerEdits);
  });

  it("clears a stored session", async () => {
    await writeCachedSession(sampleSession());
    await clearCachedSession();

    expect(await readCachedSession()).toBeNull();
  });

  it("expires a session after a week", async () => {
    await writeCachedSession(sampleSession());
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(SAVED_AT + SESSION_LIFETIME_MS);
    expect(await readCachedSession()).not.toBeNull();

    now.mockReturnValue(SAVED_AT + SESSION_LIFETIME_MS + 1);
    expect(await readCachedSession()).toBeNull();
  });

  it("backfills follower edits missing from an older session", async () => {
    vi.spyOn(Date, "now").mockReturnValue(SAVED_AT + 1000);

    await writeRawSession({ ...sampleSession(), followerEdits: undefined });
    expect((await readCachedSession())?.followerEdits).toEqual(
      emptyFollowerEdits(),
    );

    await writeRawSession({
      ...sampleSession(),
      followerEdits: { fields: "not-a-list" },
    });
    expect((await readCachedSession())?.followerEdits).toEqual(
      emptyFollowerEdits(),
    );
  });

  it("rejects malformed cached records", async () => {
    vi.spyOn(Date, "now").mockReturnValue(SAVED_AT + 1000);
    const malformed: unknown[] = [
      "not-a-record",
      { ...sampleSession(), bytes: "not-a-buffer" },
      { ...sampleSession(), fileName: 7 },
      { ...sampleSession(), savedAt: "yesterday" },
      { ...sampleSession(), doctrineHistory: "none" },
      { ...sampleSession(), cultEdits: null },
      {
        ...sampleSession(),
        cultEdits: { additions: [], resources: "none" },
      },
    ];

    for (const record of malformed) {
      await writeRawSession(record);
      expect(await readCachedSession()).toBeNull();
    }
  });

  it("degrades to null when IndexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);

    await expect(
      writeCachedSession(sampleSession()),
    ).resolves.toBeUndefined();
    expect(await readCachedSession()).toBeNull();
    await expect(clearCachedSession()).resolves.toBeUndefined();
  });
});
