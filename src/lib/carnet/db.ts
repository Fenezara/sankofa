/**
 * Sankofa — Carnet chiffré : couche IndexedDB (via la lib `idb`)
 *
 * Base : `aya-carnet`
 * Object stores :
 *  - `meta`     : { key, value } — sel, pinVerifyHash, createdAt, attempts
 *  - `entries`  : { id, type, createdAt, updatedAt, encryptedData }
 *
 * L'encryptedData est stocké sous forme sérialisée base64 (iv + ciphertext),
 * jamais en clair. La clé de chiffrement n'est JAMAIS persistée ici.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type CarnetEntryType =
  | "consultation"
  | "test"
  | "rappel"
  | "note"
  | "allergie"
  | "antecedent";

export interface CarnetEntryData {
  // Consultation
  date?: string;
  motif?: string;
  persona?: "Aya" | "Yao" | "Tonton Koffi";
  resume?: string;
  orientation?: string;
  // Test
  testType?: string;
  testResult?: string;
  nextAppointment?: string;
  // Rappel
  reminderDate?: string;
  reminderMotif?: string;
  recurring?: boolean;
  // Note
  content?: string;
  // Allergie / Antécédent
  label?: string;
  severity?: "legere" | "moderee" | "severe";
}

export interface SerializedEncrypted {
  iv: string;
  ciphertext: string;
}

export interface CarnetEntryRecord {
  id: string;
  type: CarnetEntryType;
  createdAt: number;
  updatedAt: number;
  encryptedData: SerializedEncrypted;
}

export type CarnetMetaKey =
  | "salt"
  | "verifySalt"
  | "pinVerifyHash"
  | "createdAt"
  | "attempts";

export interface CarnetMetaRecord {
  key: CarnetMetaKey;
  value: string | number;
}

interface CarnetDB extends DBSchema {
  meta: {
    key: CarnetMetaKey;
    value: CarnetMetaRecord;
  };
  entries: {
    key: string;
    value: CarnetEntryRecord;
    indexes: { "by-type": CarnetEntryType; "by-updatedAt": number };
  };
}

const DB_NAME = "aya-carnet";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CarnetDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CarnetDB>> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB non disponible."));
  }
  if (!dbPromise) {
    dbPromise = openDB<CarnetDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("entries")) {
          const store = db.createObjectStore("entries", { keyPath: "id" });
          store.createIndex("by-type", "type");
          store.createIndex("by-updatedAt", "updatedAt");
        }
      },
    });
  }
  return dbPromise;
}

/* ---------------- META ---------------- */

export async function metaGet(key: CarnetMetaKey): Promise<string | number | undefined> {
  const db = await getDB();
  const rec = await db.get("meta", key);
  return rec?.value;
}

export async function metaSet(key: CarnetMetaKey, value: string | number): Promise<void> {
  const db = await getDB();
  await db.put("meta", { key, value });
}

export async function metaDelete(key: CarnetMetaKey): Promise<void> {
  const db = await getDB();
  await db.delete("meta", key);
}

export async function metaClear(): Promise<void> {
  const db = await getDB();
  await db.clear("meta");
}

/* ---------------- ENTRIES ---------------- */

export async function entryPut(entry: CarnetEntryRecord): Promise<void> {
  const db = await getDB();
  await db.put("entries", entry);
}

export async function entryGet(id: string): Promise<CarnetEntryRecord | undefined> {
  const db = await getDB();
  return db.get("entries", id);
}

export async function entryDelete(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("entries", id);
}

export async function entryListAll(): Promise<CarnetEntryRecord[]> {
  const db = await getDB();
  return db.getAll("entries");
}

export async function entryListByType(type: CarnetEntryType): Promise<CarnetEntryRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("entries", "by-type", type);
}

export async function entryClear(): Promise<void> {
  const db = await getDB();
  await db.clear("entries");
}

/* ---------------- FULL WIPE ---------------- */

export async function wipeAll(): Promise<void> {
  await metaClear();
  await entryClear();
}

/**
 * Export brut (chiffré) : tout le contenu de la base, prêt à être
 * ré-assemblé en un fichier .aya.
 */
export async function exportRaw(): Promise<{
  meta: CarnetMetaRecord[];
  entries: CarnetEntryRecord[];
}> {
  const db = await getDB();
  const meta = await db.getAll("meta");
  const entries = await db.getAll("entries");
  return { meta, entries };
}

/**
 * Import brut (chiffré) : remplace tout le contenu de la base.
 */
export async function importRaw(data: {
  meta: CarnetMetaRecord[];
  entries: CarnetEntryRecord[];
}): Promise<void> {
  await wipeAll();
  const db = await getDB();
  const tx = db.transaction(["meta", "entries"], "readwrite");
  for (const m of data.meta) await tx.objectStore("meta").put(m);
  for (const e of data.entries) await tx.objectStore("entries").put(e);
  await tx.done;
}
