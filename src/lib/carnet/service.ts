/**
 * Sankofa — Carnet chiffré : service (API haut niveau pour l'UI)
 *
 * Gère :
 *  - setup / unlock / lock
 *  - CRUD entries (avec chiffrement transparent)
 *  - export/import .aya (blob chiffré)
 *  - auto-lock après 5 min d'inactivité
 *  - max 5 tentatives de PIN avant wipe
 *
 * La CryptoKey est conservée en variable de module (JAMAIS en localStorage).
 * Elle est effacée sur lockCarnet() ou après 5 min sans activité.
 */

import { v4 as uuidv4 } from "uuid";
import {
  deriveKey,
  encrypt,
  decrypt,
  hashPinForVerify,
  generateSalt,
  serializeEncrypted,
  deserializeEncrypted,
} from "./crypto";
import {
  type CarnetEntryType,
  type CarnetEntryData,
  type CarnetEntryRecord,
  type CarnetMetaKey,
  metaGet,
  metaSet,
  metaClear,
  entryPut,
  entryGet,
  entryDelete,
  entryListAll,
  entryListByType,
  entryClear,
  wipeAll,
  exportRaw,
  importRaw,
} from "./db";

const MAX_ATTEMPTS = 5;
const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 min
const WARN_BEFORE_LOCK_MS = 30 * 1000; // 30 s

export type { CarnetEntryType, CarnetEntryData, CarnetEntryRecord } from "./db";

export interface CarnetEntry {
  id: string;
  type: CarnetEntryType;
  createdAt: number;
  updatedAt: number;
  data: CarnetEntryData;
}

export interface UnlockResult {
  success: boolean;
  attemptsLeft?: number;
  wiped?: boolean;
}

/* ---------- État en mémoire (jamais persisté) ---------- */

let memoryKey: CryptoKey | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
const warnCallbacks = new Set<() => void>();
const lockCallbacks = new Set<() => void>();

/* ---------- Helpers ---------- */

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
}

function clearTimers() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
  if (warnTimer) {
    clearTimeout(warnTimer);
    warnTimer = null;
  }
}

function resetAutoLock() {
  if (!memoryKey) return;
  clearTimers();
  warnTimer = setTimeout(() => {
    warnCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }, AUTO_LOCK_MS - WARN_BEFORE_LOCK_MS);
  autoLockTimer = setTimeout(() => {
    lockCarnet();
  }, AUTO_LOCK_MS);
}

export function onAutoLockWarn(cb: () => void): () => void {
  warnCallbacks.add(cb);
  return () => warnCallbacks.delete(cb);
}

export function onLock(cb: () => void): () => void {
  lockCallbacks.add(cb);
  return () => lockCallbacks.delete(cb);
}

/* ---------- Setup / Unlock / Lock ---------- */

export async function isCarnetSetup(): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const hash = await metaGet("pinVerifyHash");
    const salt = await metaGet("salt");
    return !!hash && !!salt;
  } catch {
    return false;
  }
}

/**
 * Première initialisation du carnet : génère les sels, dérive la clé,
 * stocke le hash de vérification. Le PIN lui-même n'est jamais persisté.
 */
export async function setupCarnet(pin: string): Promise<void> {
  if (!isBrowser()) throw new Error("Carnet : navigateur requis.");
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("Le PIN doit être composé de 6 chiffres.");
  }
  const already = await isCarnetSetup();
  if (already) {
    throw new Error("Le carnet est déjà configuré. Verrouille-le d'abord ou efface-le.");
  }
  const salt = generateSalt();
  const verifySalt = generateSalt();
  const key = await deriveKey(pin, salt);
  const pinVerifyHash = await hashPinForVerify(pin, verifySalt);

  // Stockage des métadonnées (jamais le PIN ni la clé)
  await metaSet("salt", bytesToB64(salt));
  await metaSet("verifySalt", bytesToB64(verifySalt));
  await metaSet("pinVerifyHash", pinVerifyHash);
  await metaSet("createdAt", Date.now());
  await metaSet("attempts", 0);

  memoryKey = key;
  resetAutoLock();
}

/**
 * Déverrouille le carnet en vérifiant le PIN via le hash de vérification.
 * Si le PIN est correct, dérive la clé de chiffrement et la garde en mémoire.
 * Si incorrect, incrémente le compteur d'essais ; à 5 essais → wipe complet.
 */
export async function unlockCarnet(pin: string): Promise<UnlockResult> {
  if (!isBrowser()) return { success: false };
  if (!/^\d{6}$/.test(pin)) {
    return { success: false };
  }
  const saltB64 = (await metaGet("salt")) as string | undefined;
  const verifySaltB64 = (await metaGet("verifySalt")) as string | undefined;
  const storedHash = (await metaGet("pinVerifyHash")) as string | undefined;
  if (!saltB64 || !verifySaltB64 || !storedHash) {
    return { success: false };
  }

  const verifySalt = b64ToBytes(verifySaltB64);
  const candidateHash = await hashPinForVerify(pin, verifySalt);

  if (candidateHash === storedHash) {
    const salt = b64ToBytes(saltB64);
    memoryKey = await deriveKey(pin, salt);
    await metaSet("attempts", 0);
    resetAutoLock();
    return { success: true };
  }

  // Échec : incrémenter attempts
  const prev = ((await metaGet("attempts")) as number | undefined) ?? 0;
  const next = prev + 1;
  if (next >= MAX_ATTEMPTS) {
    // Wipe complet avec warning
    await wipeAll();
    memoryKey = null;
    clearTimers();
    return { success: false, attemptsLeft: 0, wiped: true };
  }
  await metaSet("attempts", next);
  return { success: false, attemptsLeft: MAX_ATTEMPTS - next };
}

/**
 * Verrouille le carnet : efface la clé en mémoire et les timers.
 */
export function lockCarnet(): void {
  memoryKey = null;
  clearTimers();
  lockCallbacks.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore
    }
  });
}

export function isUnlocked(): boolean {
  return memoryKey !== null;
}

/**
 * Signale une activité utilisateur (reset le timer d'auto-lock).
 */
export function touchCarnet(): void {
  resetAutoLock();
}

/* ---------- CRUD entries ---------- */

function requireKey(): CryptoKey {
  if (!memoryKey) {
    throw new Error("Carnet verrouillé. Déverrouille avec ton PIN.");
  }
  return memoryKey;
}

export async function addEntry(
  entry: Omit<CarnetEntry, "id" | "createdAt" | "updatedAt">,
): Promise<CarnetEntry> {
  const key = requireKey();
  const now = Date.now();
  const id = uuidv4();
  const record: CarnetEntryRecord = {
    id,
    type: entry.type,
    createdAt: now,
    updatedAt: now,
    encryptedData: serializeEncrypted(await encrypt(entry.data, key)),
  };
  await entryPut(record);
  touchCarnet();
  return { id, type: entry.type, createdAt: now, updatedAt: now, data: entry.data };
}

export async function updateEntry(
  id: string,
  patch: Partial<CarnetEntryData>,
): Promise<void> {
  const key = requireKey();
  const rec = await entryGet(id);
  if (!rec) throw new Error("Entrée introuvable.");
  const decrypted = (await decrypt(deserializeEncrypted(rec.encryptedData), key)) as CarnetEntryData;
  const merged: CarnetEntryData = { ...decrypted, ...patch };
  const updated: CarnetEntryRecord = {
    ...rec,
    updatedAt: Date.now(),
    encryptedData: serializeEncrypted(await encrypt(merged, key)),
  };
  await entryPut(updated);
  touchCarnet();
}

export async function deleteEntry(id: string): Promise<void> {
  await entryDelete(id);
  touchCarnet();
}

export async function listEntries(type?: CarnetEntryType): Promise<CarnetEntry[]> {
  const key = requireKey();
  const records = type ? await entryListByType(type) : await entryListAll();
  const out: CarnetEntry[] = [];
  for (const rec of records) {
    try {
      const data = (await decrypt(deserializeEncrypted(rec.encryptedData), key)) as CarnetEntryData;
      out.push({
        id: rec.id,
        type: rec.type,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        data,
      });
    } catch {
      // Skip corrompu — ne jamais planter l'UI
    }
  }
  // Tri : plus récent d'abord
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

export async function wipeCarnet(): Promise<void> {
  await wipeAll();
  memoryKey = null;
  clearTimers();
}

/* ---------- Export / Import (.aya) ---------- */

/**
 * Exporte tout le carnet (méta + entries) en un Blob chiffré unique.
 * Le PIN n'est PAS inclus — il faudra le retaper à l'import.
 *
 * Format : JSON { version, exportedAt, meta, entries }
 */
export async function exportEncrypted(): Promise<Blob> {
  const raw = await exportRaw();
  const payload = {
    format: "aya-carnet",
    version: 1,
    exportedAt: Date.now(),
    meta: raw.meta,
    entries: raw.entries,
  };
  const json = JSON.stringify(payload);
  return new Blob([json], { type: "application/octet-stream" });
}

/**
 * Importe un fichier .aya chiffré (exporté par exportEncrypted).
 * Remplace tout le contenu existant. Le PIN doit être fourni pour valider
 * que les données pourront être déchiffrées (le hash de vérification est
 * contrôlé après import).
 */
export async function importEncrypted(blob: Blob, pin: string): Promise<void> {
  if (!isBrowser()) throw new Error("Carnet : navigateur requis.");
  const text = await blob.text();
  let payload: {
    format?: string;
    version?: number;
    meta: { key: CarnetMetaKey; value: string | number }[];
    entries: CarnetEntryRecord[];
  };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Fichier .aya illisible (JSON invalide).");
  }
  if (payload.format !== "aya-carnet") {
    throw new Error("Ce fichier n est pas un export Sankofa valide.");
  }
  // Vérifier que le PIN fourni correspond au hash contenu dans l'export
  const metaMap = new Map(payload.meta.map((m) => [m.key, m.value]));
  const storedHash = metaMap.get("pinVerifyHash") as string | undefined;
  const verifySaltB64 = metaMap.get("verifySalt") as string | undefined;
  if (!storedHash || !verifySaltB64) {
    throw new Error("Export corrompu (hash de vérification manquant).");
  }
  const candidateHash = await hashPinForVerify(pin, b64ToBytes(verifySaltB64));
  if (candidateHash !== storedHash) {
    throw new Error("PIN incorrect pour ce fichier d'export.");
  }
  // Tout est OK : on remplace la base
  await importRaw({ meta: payload.meta, entries: payload.entries });
  // Déverrouille en mémoire avec le PIN fourni
  const saltB64 = metaMap.get("salt") as string | undefined;
  if (!saltB64) throw new Error("Export corrompu (sel manquant).");
  memoryKey = await deriveKey(pin, b64ToBytes(saltB64));
  resetAutoLock();
}

/* ---------- Internes ---------- */

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- Constantes exportées (UI) ---------- */

export const CARNET_MAX_ATTEMPTS = MAX_ATTEMPTS;
export const CARNET_AUTO_LOCK_MS = AUTO_LOCK_MS;
export const CARNET_WARN_BEFORE_LOCK_MS = WARN_BEFORE_LOCK_MS;
