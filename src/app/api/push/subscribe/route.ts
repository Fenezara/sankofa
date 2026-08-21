/**
 * GET  /api/push/subscribe
 * POST /api/push/subscribe
 *
 * GET  : renvoie la clé publique VAPID (pour que le client puisse s'abonner
 *        via `serviceWorkerRegistration.pushManager.subscribe({
 *          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
 *        })`).
 *        Renvoie 200 + { configured: false } en dev mode (clés non posées).
 *
 * POST : sauvegarde un abonnement push en base (model PushSubscription).
 *        Body attendu :
 *          {
 *            anonymousId: string,
 *            subscription: {
 *              endpoint: string,
 *              keys: { p256dh: string, auth: string }
 *            }
 *          }
 *        Idempotent : si l'endpoint existe déjà pour cet anonymousId, on ne
 *        crée pas de doublon (juste updatedAt implicite via upsert-like).
 *        Renvoie 200 + { ok: true, id }.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export const runtime = "nodejs";

interface PushSubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  anonymousId?: string;
}

interface SubscribeRequestBody {
  anonymousId?: string;
  subscription?: PushSubscriptionBody;
}

export async function GET() {
  const publicKey = getVapidPublicKey();
  return NextResponse.json({
    configured: isPushConfigured(),
    vapidPublicKey: publicKey,
  });
}

export async function POST(req: Request) {
  let body: SubscribeRequestBody;
  try {
    body = (await req.json()) as SubscribeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const anonymousId = (body.anonymousId ?? "").trim();
  const subscription = body.subscription;
  const endpoint = subscription?.endpoint ?? "";
  const p256dh = subscription?.keys?.p256dh ?? "";
  const auth = subscription?.keys?.auth ?? "";

  if (!anonymousId) {
    return NextResponse.json(
      { error: 'Le paramètre "anonymousId" est requis.' },
      { status: 400 },
    );
  }
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Subscription invalide (endpoint, p256dh, auth requis)." },
      { status: 400 },
    );
  }

  if (!isPushConfigured()) {
    console.warn(
      "[push/subscribe] VAPID env vars absentes — abonnement sauvegardé en base mais pas de push réel possible (dev mode).",
    );
  }

  try {
    // Idempotence : si l'endpoint existe déjà pour ce user, on update les clés
    // (elles peuvent tourner) au lieu de dupliquer.
    const existing = await db.pushSubscription.findFirst({
      where: { anonymousId, endpoint },
    });

    let record;
    if (existing) {
      record = await db.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh, auth },
      });
      console.log(
        `[push/subscribe] Subscription ${existing.id} mise à jour pour ${anonymousId}.`,
      );
    } else {
      record = await db.pushSubscription.create({
        data: {
          anonymousId,
          endpoint,
          p256dh,
          auth,
        },
      });
      console.log(
        `[push/subscribe] Nouvelle subscription ${record.id} pour ${anonymousId}.`,
      );
    }

    return NextResponse.json({ ok: true, id: record.id });
  } catch (err) {
    console.error("[push/subscribe] DB error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde de l'abonnement." },
      { status: 500 },
    );
  }
}
