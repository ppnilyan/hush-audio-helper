/** Local history of generated montages, kept 5 hours in IndexedDB. */

export type StoredMontage = {
  id: string;
  createdAt: number;
  expiresAt: number;
  duration: number;
  mime: string;
  ext: string;
  blob: Blob;
};

export type HistoryEntry = Omit<StoredMontage, "blob"> & { url: string };

export const RETENTION_MS = 5 * 60 * 60 * 1000;

const DB_NAME = "montage-history";
const STORE = "videos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponible"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Erreur de stockage"));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveMontage(entry: StoredMontage): Promise<void> {
  await tx("readwrite", (s) => s.put(entry) as IDBRequest<IDBValidKey>);
}

export async function deleteMontage(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/** Returns non-expired entries (newest first) and purges the expired ones. */
export async function listMontages(): Promise<HistoryEntry[]> {
  const all = await tx<StoredMontage[]>(
    "readonly",
    (s) => s.getAll() as IDBRequest<StoredMontage[]>,
  );
  const now = Date.now();
  const alive: HistoryEntry[] = [];
  for (const item of all) {
    if (item.expiresAt <= now) {
      void deleteMontage(item.id);
      continue;
    }
    alive.push({ ...item, url: URL.createObjectURL(item.blob) });
  }
  return alive.sort((a, b) => b.createdAt - a.createdAt);
}

export function remainingLabel(expiresAt: number): string {
  const ms = Math.max(0, expiresAt - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min restantes` : `${m} min restantes`;
}

/** Best available recording format, preferring MP4. */
export function pickRecordingType(): { mime: string; ext: string } {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return { mime, ext: "mp4" };
    }
  }
  const webm = [
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
  return { mime: webm ?? "video/webm", ext: "webm" };
}
