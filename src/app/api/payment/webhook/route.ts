/**
 * POST /api/payment/webhook
 *
 * Webhook de notification CinetPay.
 *
 * CinetPay envoie un POST quand le statut d'une transaction change
 * (paiement confirmé, refusé, annulé). Le payload contient au minimum :
 *   {
 *     transaction_id: "AYA-XXX-XXX",  // notre providerTxId
 *     status: "ACCEPTED" | "REFUSED" | "CANCELED" | ...,
 *     amount: 1500,
 *     ...
 *   }
 *
 * Comportement :
 *   1. Parse le payload.
 *   2. Trouve la PaymentTransaction en base par providerTxId.
 *   3. Map le statut CinetPay → notre statut interne (success/failed/pending).
 *   4. Met à jour la DB.
 *   5. Renvoie 200 ACK à CinetPay (sinon retry en boucle).
 *
 * Note sécurité : en production, CinetPay fournit un mécanisme de signature
 * (HMAC). On log si la signature est absente — à brancher quand le secret
 * sera posé. Le webhook ne doit JAMAIS exécuter d'action sensible basée sur
 * un payload non vérifié ; ici on ne fait que mettre à jour un statut en base.
 *
 * Si env vars CinetPay ne sont pas posées (mode dev), on renvoie 200 ACK sans
 * rien faire — aucun webhook réel ne doit arriver, mais si on reçoit quand
 * même un POST, on ne casse pas.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isCinetPayConfigured } from "@/lib/cinetpay";

export const runtime = "nodejs";

interface CinetPayWebhookPayload {
  transaction_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  signature?: string;
  [key: string]: unknown;
}

/**
 * Map un statut CinetPay vers notre statut interne.
 *
 * Statuts CinetPay possibles (docs CinetPay) :
 *  - "ACCEPTED"      → paiement confirmé → "success"
 *  - "REFUSED"       → paiement refusé → "failed"
 *  - "CANCELED"      → paiement annulé → "failed"
 *  - "PENDING"       → en attente → "pending"
 *  - "WAITING"       → en attente client → "pending"
 *  - autres          → on laisse en "pending" (ne pas marquer failed par erreur)
 */
function mapStatus(cinetpayStatus: string | undefined): "pending" | "success" | "failed" {
  const s = (cinetpayStatus ?? "").toUpperCase();
  if (s === "ACCEPTED") return "success";
  if (s === "REFUSED" || s === "CANCELED") return "failed";
  return "pending";
}

export async function POST(req: Request) {
  // ACK immédiat vers CinetPay — important pour éviter les retries.
  // On fait le traitement avant, puis on renvoie 200.

  if (!isCinetPayConfigured()) {
    console.warn(
      "[payment/webhook] Payload reçu mais CINETPAY env vars absentes — mode dev, ignoré.",
    );
    return NextResponse.json({ status: "ok", dev: true }, { status: 200 });
  }

  let body: CinetPayWebhookPayload;
  try {
    body = (await req.json()) as CinetPayWebhookPayload;
  } catch {
    // CinetPay envoie parfois du form-encoded — on tente ce format.
    try {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = {
        transaction_id: params.get("transaction_id") ?? undefined,
        status: params.get("status") ?? undefined,
        amount: params.get("amount") ? Number(params.get("amount")) : undefined,
      };
    } catch {
      console.error("[payment/webhook] Payload invalide (JSON et form-encoded échouent).");
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }
  }

  const providerTxId = body.transaction_id;
  const newStatus = mapStatus(body.status);

  if (!providerTxId) {
    console.warn("[payment/webhook] Pas de transaction_id dans le payload.");
    return NextResponse.json({ error: "missing_transaction_id" }, { status: 400 });
  }

  // Note sécurité : en production, vérifier la signature CinetPay ici.
  // CinetPay utilise un hash HMAC du payload avec une clé secrète partagée.
  // Si la signature est invalide → 401. À brancher quand CINETPAY_SECRET sera posé.
  if (!body.signature) {
    console.warn(
      `[payment/webhook] Signature absente pour tx ${providerTxId} — à vérifier en production.`,
    );
  }

  try {
    const tx = await db.paymentTransaction.findFirst({
      where: { providerTxId },
    });

    if (!tx) {
      console.warn(
        `[payment/webhook] Transaction ${providerTxId} introuvable en base.`,
      );
      // On renvoie 200 pour éviter les retries CinetPay sur une tx qu'on ne connaît pas.
      return NextResponse.json(
        { status: "ok", warning: "transaction_not_found" },
        { status: 200 },
      );
    }

    if (tx.status === newStatus) {
      // Idempotence : déjà à jour (CinetPay peut renvoyer le même webhook).
      return NextResponse.json({ status: "ok", idempotent: true }, { status: 200 });
    }

    await db.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: newStatus },
    });

    console.log(
      `[payment/webhook] Tx ${providerTxId} → ${newStatus} (was ${tx.status}).`,
    );

    return NextResponse.json({ status: "ok", txStatus: newStatus }, { status: 200 });
  } catch (err) {
    console.error("[payment/webhook] DB error:", err);
    // On renvoie 200 même en erreur DB — CinetPay retry sinon, et on risque
    // de la spammer. L'erreur est loggée, on peut la traiter manuellement.
    return NextResponse.json(
      { status: "error", error: "db_update_failed" },
      { status: 200 },
    );
  }
}
