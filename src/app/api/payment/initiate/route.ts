/**
 * POST /api/payment/initiate
 *
 * Body: { tier: 'plan_action' | 'teleconsultation', phone: string, anonymousId: string }
 * Response: { status: 'pending', transactionId, providerTxId?, paymentUrl?, amount, message }
 *
 * Initie un paiement Mobile Money pour un plan d'action (1500 FCFA) ou une
 * téléconsultation humaine de garde (3000 FCFA).
 *
 * Comportement :
 *  - Si CINETPAY_API_KEY + CINETPAY_SITE_ID sont posées → vraie init CinetPay.
 *    On génère un providerTxId au format `AYA-{ts}-{rand}` et on renvoie
 *    `paymentUrl` pour rediriger le client vers la page CinetPay.
 *  - Sinon → simulation dev mode (transaction pending en DB, pas d'URL).
 *
 * La transaction est créée en base avec status 'pending' dès maintenant.
 * Le webhook /api/payment/webhook confirmera (status 'success' / 'failed').
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  initiateCinetPayPayment,
  isCinetPayConfigured,
  generateTransactionId,
} from "@/lib/cinetpay";

export const runtime = "nodejs";

interface PaymentRequestBody {
  tier?: "plan_action" | "teleconsultation";
  phone?: string;
  anonymousId?: string;
}

const PRICING: Record<"plan_action" | "teleconsultation", number> = {
  plan_action: 1500,
  teleconsultation: 3000,
};

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "*".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  // Numéros CI : 10 chiffres (ex: 07XXXXXXXX, 05XXXXXXXX, 01XXXXXXXX, 27XXXXXXXX)
  // ou format international (+225 ...)
  return digits.length >= 8 && digits.length <= 15;
}

export async function POST(req: Request) {
  let body: PaymentRequestBody;
  try {
    body = (await req.json()) as PaymentRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const tier = body.tier;
  const phone = (body.phone ?? "").trim();
  const anonymousId = (body.anonymousId ?? "").trim();

  if (!tier || !(tier in PRICING)) {
    return NextResponse.json(
      { error: 'Le paramètre "tier" doit être "plan_action" ou "teleconsultation".' },
      { status: 400 },
    );
  }
  if (!phone || !isValidPhone(phone)) {
    return NextResponse.json(
      { error: "Numéro de téléphone invalide." },
      { status: 400 },
    );
  }
  if (!anonymousId) {
    return NextResponse.json(
      { error: 'Le paramètre "anonymousId" est requis.' },
      { status: 400 },
    );
  }

  const amount = PRICING[tier];
  const phoneMasked = maskPhone(phone);

  // === Mode production : vraie init CinetPay ===
  if (isCinetPayConfigured()) {
    const providerTxId = generateTransactionId();
    const tierLabel =
      tier === "plan_action"
        ? "plan d action personnalisé Sankofa"
        : "téléconsultation humaine de garde Sankofa";

    // Crée d'abord la transaction en base (pending).
    let tx;
    try {
      tx = await db.paymentTransaction.create({
        data: {
          anonymousId,
          tier,
          amount,
          phoneMasked,
          status: "pending",
          provider: "cinetpay",
          providerTxId,
        },
      });
    } catch (err) {
      console.error("[payment] Erreur création transaction CinetPay:", err);
      return NextResponse.json(
        { error: "Erreur lors de l'initiation du paiement. Réessaie dans un instant." },
        { status: 500 },
      );
    }

    // Appelle CinetPay pour obtenir l'URL de paiement.
    const result = await initiateCinetPayPayment({
      transactionId: providerTxId,
      amount,
      phone,
      description: tierLabel,
    });

    if (!result.success) {
      // Marque la transaction comme failed et informe le client.
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { error: result.error ?? "CinetPay a refusé l'initiation du paiement." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "pending",
      transactionId: tx.id,
      providerTxId,
      paymentUrl: result.paymentUrl,
      amount,
      message:
        `Paiement ${amount} FCFA initié via CinetPay pour le ${tierLabel}. ` +
        `Réf: ${providerTxId}.`,
    });
  }

  // === Mode dev (simulation) — comportement d'origine ===
  try {
    const tx = await db.paymentTransaction.create({
      data: {
        anonymousId,
        tier,
        amount,
        phoneMasked,
        status: "pending",
        provider: "simulation",
      },
    });

    const tierLabel =
      tier === "plan_action"
        ? "plan d'action personnalisé"
        : "téléconsultation humaine de garde";

    return NextResponse.json({
      status: "pending",
      transactionId: tx.id,
      amount,
      message:
        `Paiement ${amount} FCFA initié pour le ${tierLabel}. ` +
        `Confirme la transaction dans ton app Mobile Money (numéro se terminant par ${phoneMasked.slice(-4)}). ` +
        `Réf: ${tx.id.slice(-8).toUpperCase()}. ` +
        `(Mode dev — pose CINETPAY_API_KEY pour activer les vrais paiements.)`,
    });
  } catch (err) {
    console.error("[payment] Erreur création transaction (dev):", err);
    return NextResponse.json(
      { error: "Erreur lors de l'initiation du paiement. Réessaie dans un instant." },
      { status: 500 },
    );
  }
}
