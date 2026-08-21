/**
 * Sankofa — Auth utilities (Task 12)
 *
 * Phone-based authentication helpers. NO email — young Ivorians use phone numbers.
 *
 * Privacy model:
 *   - Raw phone number NEVER stored in DB.
 *   - SHA-256 hash (phoneHash) used as unique key — one-way, cannot be reversed.
 *   - Masked version (phoneMasked) for UI display: "+225 07 XX XX XX 04".
 *   - OTP codes are hashed with bcrypt (10 rounds) before storage.
 *
 * Anonymity by default — these helpers are only invoked when the user CHOOSES
 * to authenticate. The anonymous flow (UUID local) remains untouched.
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Normalise un numéro de téléphone au format E.164 (+225XXXXXXXXXX).
 * Accepte :
 *   - "+225 07 01 02 03 04"
 *   - "2250701020304"
 *   - "0701020304"  → préfixe "+225"
 *   - "07 01 02 03 04"  → préfixe "+225"
 *
 * @returns le numéro normalisé, ou null si invalide.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  // Supprime tout sauf les chiffres et le + initial
  let cleaned = raw.replace(/[^\d+]/g, "");
  // Si commence par +, on garde
  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(1).replace(/\D/g, "");
  } else {
    // Sans + : si commence par 225 et fait 12+ chiffres → +225...
    if (cleaned.startsWith("225") && cleaned.length >= 12) {
      cleaned = "+" + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith("0")) {
      // Numéro local ivoirien (10 chiffres commençant par 0)
      cleaned = "+225" + cleaned;
    } else {
      cleaned = "+" + cleaned;
    }
  }

  // Validation finale : +225 + 10 chiffres
  const match = cleaned.match(/^\+225(\d{10})$/);
  if (!match) return null;

  const national = match[1];
  // Préfixes opérateurs valides en Côte d'Ivoire :
  //   01 XX (Moov Africa), 05 XX (MTN), 07 XX (Orange)
  if (!/^0[157]/.test(national)) return null;

  return cleaned;
}

/**
 * Hash un numéro de téléphone avec SHA-256.
 * Le hash est one-way : impossible de retrouver le numéro original.
 * Utilisé comme clé unique dans la table User (phoneHash).
 */
export function hashPhone(phone: string): string {
  return crypto.createHash("sha256").update(phone).digest("hex");
}

/**
 * Masque un numéro pour l'affichage UI.
 * Ex: "+2250701020304" → "+225 07 XX XX XX 04"
 *
 * Conserve l'indicatif + les 2 premiers chiffres de l'opérateur + les 2 derniers
 * (pour reconnaissance visuelle par l'utilisateur). Le reste est remplacé par XX.
 */
export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  // normalized = "+2250701020304"
  const cc = normalized.slice(0, 4); // "+225"
  const national = normalized.slice(4); // "0701020304"
  if (national.length < 10) return phone;
  const opPrefix = national.slice(0, 2); // "07"
  const last2 = national.slice(-2); // "04"
  const middle = national.slice(2, -2); // "010203"
  // On groupe le middle en paires de 2 pour le visuel : "01 02 03" → "XX XX XX"
  const middlePairs = middle.match(/.{1,2}/g) ?? [];
  const maskedMiddle = middlePairs.map(() => "XX").join(" ");
  return `${cc} ${opPrefix} ${maskedMiddle} ${last2}`.trim();
}

/**
 * Génère un code OTP à 6 chiffres (100000–999999).
 * Pas cryptographiquement sécurisé — suffisant pour OTP SMS/WhatsApp
 * avec rate-limit + expiration + max attempts.
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash un code OTP avec bcrypt (10 rounds).
 * Le hash est stocké en DB au lieu du code en clair — un leak de DB
 * ne compromet pas les OTP en cours de validité.
 */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

/**
 * Vérifie un code OTP contre son hash bcrypt.
 * @returns true si le code correspond au hash, false sinon.
 */
export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(code, hash);
  } catch {
    return false;
  }
}

/**
 * Vérifie si un OTP est expiré.
 * @param expiresAt date d'expiration stockée en DB
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/** Durée de validité d'un OTP : 10 minutes. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** Nombre maximum de tentatives de vérification par OTP. */
export const OTP_MAX_ATTEMPTS = 5;

/** Nombre maximum d'OTP envoyés par téléphone par heure (rate limit). */
export const OTP_RATE_LIMIT_PER_HOUR = 3;

/**
 * Vérifie qu'un numéro est dans la whitelist des préfixes ivoiriens valides.
 * Utilisé par les routes API pour rejeter rapidement les numéros invalides.
 */
export function isValidIvorianPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}
