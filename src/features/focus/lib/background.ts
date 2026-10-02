/**
 * Which background focus mode shows, per device: one of the built-in scenes,
 * or a picture you uploaded. The picture itself lives in this browser's
 * IndexedDB and never leaves it; only the choice is in localStorage.
 */
export const SCENES = [
  { id: "sundown", label: "Pixel sundown" },
  { id: "rain", label: "Rainy night" },
  { id: "sakura", label: "Sakura hill" },
  { id: "ocean", label: "Ocean dusk" },
  { id: "camp", label: "Starry camp" },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];
export type Background = SceneId | "custom";

export const DEFAULT_BACKGROUND: Background = "sundown";
/** Phone photos are a few MB; anything much larger is not a background. */
export const MAX_CUSTOM_BYTES = 15 * 1024 * 1024;

const KEY = "ottolabs:focus-background";

export function isScene(value: unknown): value is SceneId {
  return SCENES.some((s) => s.id === value);
}

export function parseBackground(raw: string | null): Background {
  if (raw === "custom" || isScene(raw)) return raw;
  return DEFAULT_BACKGROUND;
}

// ── The choice, as an external store ───────────────────────────────────────

let cached: Background | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readBackground(): Background {
  cached ??= parseBackground(storage()?.getItem(KEY) ?? null);
  return cached;
}

export function writeBackground(value: Background): void {
  cached = value;
  try {
    storage()?.setItem(KEY, value);
  } catch {
    // Kept for this page's lifetime.
  }
  listeners.forEach((l) => l());
}

export function subscribeBackground(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── The uploaded picture, in IndexedDB ─────────────────────────────────────

const DB_NAME = "ottolabs";
const STORE = "files";
const PICTURE = "focus-background";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function saveCustomPicture(file: Blob): Promise<void> {
  await run("readwrite", (store) => store.put(file, PICTURE));
}

/** The uploaded picture, or null if there is none (or storage is blocked). */
export async function loadCustomPicture(): Promise<Blob | null> {
  try {
    return (await run<Blob | undefined>("readonly", (store) => store.get(PICTURE))) ?? null;
  } catch {
    return null;
  }
}
