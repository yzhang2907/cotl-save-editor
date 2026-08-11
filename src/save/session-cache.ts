import type { CultEdits } from "./cult-edits";
import type { AppliedDoctrineChange } from "./doctrine-workspace";
import { emptyFollowerEdits, type FollowerEdits } from "./follower-edits";

/**
 * Keeps the save that is currently open, plus every staged edit, in
 * IndexedDB so an accidental refresh does not throw the work away.
 *
 * IndexedDB rather than localStorage because a slot save is megabytes of
 * binary and localStorage only holds strings in a far smaller quota.
 */

const DATABASE_NAME = "cotl-save-editor";
const DATABASE_VERSION = 1;
const STORE_NAME = "session";
const RECORD_KEY = "current";

/** Old sessions are more likely to confuse than to help. */
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedSession {
  bytes: ArrayBuffer;
  cultEdits: CultEdits;
  doctrineHistory: AppliedDoctrineChange[];
  followerEdits: FollowerEdits;
  fileName: string;
  lastModified: number;
  savedAt: number;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    // A blocked or unavailable database is not worth surfacing: caching is
    // a convenience, and the editor works fine without it.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const database = await openDatabase();
  if (database === null) {
    return null;
  }
  try {
    return await new Promise<T | null>((resolve) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = run(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    database.close();
  }
}

function isCachedSession(
  value: unknown,
): value is Omit<CachedSession, "followerEdits"> &
  Partial<Pick<CachedSession, "followerEdits">> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<CachedSession>;
  return (
    candidate.bytes instanceof ArrayBuffer &&
    typeof candidate.fileName === "string" &&
    typeof candidate.lastModified === "number" &&
    typeof candidate.savedAt === "number" &&
    Array.isArray(candidate.doctrineHistory) &&
    typeof candidate.cultEdits === "object" &&
    candidate.cultEdits !== null &&
    Array.isArray(candidate.cultEdits.additions) &&
    Array.isArray(candidate.cultEdits.resources)
  );
}

export async function readCachedSession(): Promise<CachedSession | null> {
  const stored = await withStore<unknown>("readonly", (store) =>
    store.get(RECORD_KEY),
  );
  if (!isCachedSession(stored)) {
    return null;
  }
  if (Date.now() - stored.savedAt > SESSION_LIFETIME_MS) {
    void clearCachedSession();
    return null;
  }
  // Sessions cached before follower editing existed lack the field.
  const followerEdits =
    stored.followerEdits !== undefined &&
    Array.isArray(stored.followerEdits.fields)
      ? stored.followerEdits
      : emptyFollowerEdits();
  return { ...stored, followerEdits };
}

export async function writeCachedSession(
  session: CachedSession,
): Promise<void> {
  await withStore("readwrite", (store) => store.put(session, RECORD_KEY));
}

export async function clearCachedSession(): Promise<void> {
  await withStore("readwrite", (store) => store.delete(RECORD_KEY));
}
