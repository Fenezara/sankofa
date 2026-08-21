/**
 * Sankofa — Carnet chiffré : module cryptographique (AES-256-GCM + PBKDF2)
 *
 * Utilise Web Crypto API (native, aucune dépendance, disponible côté client).
 *
 * Architecture :
 *  - Cipher : AES-256-GCM (chiffrement authentifié)
 *  - KDF     : PBKDF2 avec SHA-256, 100 000 itérations, sel aléatoire 16 octets
 *  - IV      : 12 octets aléatoires par opération de chiffrement
 *  - PIN     : 6 chiffres, JAMAIS stocké. Uniquement un hash de vérification
 *              (PBKDF2 du PIN avec un sel séparé, 50 000 itérations).
 *
 * IMPORTANT : ce module ne doit être importé QUE côté client (Web Crypto API
 * n'est pas disponible dans Node.js sans polyfill, et `crypto.subtle` est
 * strictement navigateur).
 */

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_VERIFY_ITERATIONS = 50_000;
const SALT_LENGTH = 16; // octets
const IV_LENGTH = 12; // octets
const KEY_LENGTH = 256; // bits

export interface EncryptedPayload {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

/**
 * Génère un sel aléatoire de 16 octets via crypto.getRandomValues.
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Génère un IV aléatoire de 12 octets pour AES-GCM.
 */
export function generateIv(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Dérive une clé AES-256-GCM à partir du PIN et d'un sel (PBKDF2, 100k iter).
 * La clé est non-extractible : elle ne peut pas être lue en JS, seulement
 * utilisée pour chiffrer/déchiffrer.
 */
export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!pin) throw new Error("PIN requis pour dériver la clé.");
  if (!crypto?.subtle) throw new Error("Web Crypto API non disponible.");

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false, // non-extractible
    ["encrypt", "decrypt"],
  );
}

/**
 * Chiffre un objet JavaScript arbitraire en AES-256-GCM.
 * Retourne l'IV + le ciphertext (les deux nécessaires au déchiffrement).
 */
export async function encrypt(
  data: object,
  key: CryptoKey,
): Promise<EncryptedPayload> {
  if (!crypto?.subtle) throw new Error("Web Crypto API non disponible.");
  const iv = generateIv();
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext,
  );
  return { iv, ciphertext };
}

/**
 * Déchiffre un payload AES-256-GCM et renvoie l'objet JavaScript d'origine.
 * Lance une exception si le PIN/clé est incorrect ou les données corrompues.
 */
export async function decrypt(
  encrypted: EncryptedPayload,
  key: CryptoKey,
): Promise<object> {
  if (!crypto?.subtle) throw new Error("Web Crypto API non disponible.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encrypted.iv as BufferSource },
    key,
    encrypted.ciphertext,
  );
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(plaintext));
}

/**
 * Calcule un hash de VÉRIFICATION du PIN (PBKDF2, 50k iter) encodé en base64.
 *
 * Ce hash est stocké dans IndexedDB pour valider les tentatives de déverrouillage
 * SANS jamais stocker le PIN lui-même ni la clé de chiffrement.
 *
 * Note : ce hash ne peut PAS servir à déchiffrer les données (sel + itérations
 * différents de la clé de chiffrement). Il sert uniquement à vérifier que le
 * PIN saisi correspond à celui choisi lors de l'initialisation.
 */
export async function hashPinForVerify(pin: string, salt: Uint8Array): Promise<string> {
  if (!crypto?.subtle) throw new Error("Web Crypto API non disponible.");
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_VERIFY_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  // Base64 pour stockage lisible
  return bytesToBase64(new Uint8Array(bits));
}

/* ---------- Helpers de conversion (utilitaires publics) ---------- */

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Sérialise un EncryptedPayload en objet base64 JSON-stockable (IndexedDB
 * ne supporte pas directement les ArrayBuffer non-copiés dans tous les cas).
 */
export function serializeEncrypted(payload: EncryptedPayload): {
  iv: string;
  ciphertext: string;
} {
  return {
    iv: bytesToBase64(payload.iv),
    ciphertext: bytesToBase64(new Uint8Array(payload.ciphertext)),
  };
}

export function deserializeEncrypted(serialized: {
  iv: string;
  ciphertext: string;
}): EncryptedPayload {
  return {
    iv: base64ToBytes(serialized.iv),
    ciphertext: base64ToBytes(serialized.ciphertext).buffer as ArrayBuffer,
  };
}
