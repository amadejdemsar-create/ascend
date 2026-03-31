import { openDB, type IDBPDatabase } from "idb";

export interface OutboxEntry {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

const DB_NAME = "ascend-outbox";
const STORE_NAME = "mutations";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/** Add a mutation to the offline outbox queue */
export async function enqueue(
  entry: Omit<OutboxEntry, "timestamp">
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, { ...entry, timestamp: Date.now() });
}

/**
 * Replay all queued mutations in chronological order.
 * Stops on the first failure (still offline) and returns the count
 * of successfully drained entries.
 */
export async function drain(): Promise<number> {
  const db = await getDb();
  const entries: OutboxEntry[] = await db.getAll(STORE_NAME);

  // Sort oldest first so mutations replay in the order they were made
  entries.sort((a, b) => a.timestamp - b.timestamp);

  let drained = 0;

  for (const entry of entries) {
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      await db.delete(STORE_NAME, entry.id);
      drained++;
    } catch {
      // Network still unavailable; stop draining
      break;
    }
  }

  return drained;
}

/** Return the number of pending mutations in the outbox */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}
