/**
 * CinetPay API v2 client — Mobile Money pour l'Afrique de l'Ouest.
 *
 * Permet à Sankofa d accepter les paiements Wave, Orange Money, MTN, Moov en FCFA,
 * sans avoir à intégrer chaque opérateur séparément.
 *
 * Requires env vars:
 *  - CINETPAY_API_KEY     : clé API (dashboard CinetPay)
 *  - CINETPAY_SITE_ID     : ID du site marchand
 *  - CINETPAY_NOTIFY_URL  : URL du webhook (POST /api/payment/webhook)
 *  - CINETPAY_RETURN_URL  : URL de retour après paiement (page de succès)
 *
 * Tant que ces vars ne sont pas posées, `initiateCinetPayPayment()` simule
 * un paiement en mode dev (status 'pending', pas d'URL de paiement).
 *
 * Docs: https://docs.cinetpay.com/
 */

const API_BASE = "https://api-checkout.cinetpay.com/v2/payment";

export interface CinetPayPayment {
  /** ID de transaction côté Sankofa (format AYA-{ts}-{rand}). Doit être unique. */
  transactionId: string;
  /** Montant en FCFA (entier, minimum 100). */
  amount: number;
  /** Numéro de téléphone Mobile Money de l'utilisateur·rice (format local CI). */
  phone: string;
  /** Description courte affichée dans la page de paiement CinetPay. */
  description: string;
  /** Nom du client (optionnel, affiché dans le dashboard CinetPay). */
  customerName?: string;
}

export interface CinetPayInitResult {
  success: boolean;
  /** URL de la page de paiement CinetPay à ouvrir côté client. */
  paymentUrl?: string;
  /** Toujours 'pending' après initiation — le statut final vient via webhook. */
  status?: string;
  error?: string;
}

/**
 * Indique si les variables d'environnement CinetPay sont posées.
 */
export function isCinetPayConfigured(): boolean {
  return Boolean(
    process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID,
  );
}

/**
 * Initie un paiement CinetPay.
 *
 * En production : appelle l'API Checkout et renvoie une URL de paiement.
 * En dev (env vars absentes) : simule un paiement pending sans URL.
 *
 * @returns URL de paiement à rediriger côté client (ou undefined en dev).
 */
export async function initiateCinetPayPayment(
  payment: CinetPayPayment,
): Promise<CinetPayInitResult> {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  if (!apiKey || !siteId) {
    console.warn(
      "[CinetPay] Missing env vars — simulation du paiement (dev mode). " +
        "Pose CINETPAY_API_KEY et CINETPAY_SITE_ID pour activer les vrais paiements.",
    );
    return {
      success: true,
      status: "pending",
      paymentUrl: undefined,
    };
  }

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: payment.transactionId,
        amount: payment.amount,
        currency: "XOF",
        description: payment.description,
        // CinetPay accepte un customer name optionnel pour l'affichage dashboard
        customer_name: payment.customerName ?? "",
        customer_phone_number: payment.phone,
        notify_url: process.env.CINETPAY_NOTIFY_URL || "",
        return_url: process.env.CINETPAY_RETURN_URL || "",
        channels: "ALL",
      }),
    });

    const data = await res.json();

    // CinetPay renvoie code "201" (created) ou "200" (déjà existant) en cas de succès.
    if (data.code === "201" || data.code === "200") {
      return {
        success: true,
        paymentUrl: data.data?.payment_url,
        status: "pending",
      };
    }

    console.error("[CinetPay] Init failed:", data.code, data.message);
    return {
      success: false,
      error: data.message || "CinetPay error",
    };
  } catch (err) {
    console.error("[CinetPay] Init error:", err);
    return { success: false, error: String(err) };
  }
}

export interface CinetPayVerifyResult {
  status: "pending" | "success" | "failed";
  amount?: number;
}

/**
 * Vérifie le statut d'une transaction CinetPay (polling manuel).
 *
 * En production : appelle l'API Check de CinetPay.
 * En dev : renvoie toujours 'pending' (la simulation ne change jamais d'état).
 *
 * Note : le statut de référence est normalement poussé via webhook
 * (/api/payment/webhook), cette méthode est un fallback de polling.
 */
export async function verifyCinetPayPayment(
  transactionId: string,
): Promise<CinetPayVerifyResult> {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;

  if (!apiKey || !siteId) {
    return { status: "pending" };
  }

  try {
    const res = await fetch(`${API_BASE}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: transactionId,
      }),
    });
    const data = await res.json();
    const status = data.data?.status;
    if (status === "ACCEPTED")
      return { status: "success", amount: data.data?.amount };
    if (status === "REFUSED" || status === "CANCELED")
      return { status: "failed" };
    return { status: "pending" };
  } catch {
    return { status: "pending" };
  }
}

/**
 * Génère un ID de transaction au format Sankofa : `SKF-{timestamp}-{random}`.
 * CinetPay impose max 20 chars, donc on prend les 8 derniers du timestamp
 * + 6 chars aléatoires.
 *
 * Format final : `AYA-XXXXXXXX-XXXXXX` (18 chars).
 */
export function generateTransactionId(): string {
  const ts = Date.now().toString(36).slice(-8).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AYA-${ts}-${rand}`;
}
