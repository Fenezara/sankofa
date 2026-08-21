/**
 * GET  /api/whatsapp/webhook
 * POST /api/whatsapp/webhook
 *
 * Webhook WhatsApp Business Cloud API.
 *
 * GET : vérification du webhook par Meta. On doit renvoyer le `hub.challenge`
 *       quand `hub.mode === "subscribe"` et `hub.verify_token` correspond à
 *       WHATSAPP_VERIFY_TOKEN. Renvoie 403 sinon.
 *
 * POST : réception d'un message entrant d'un·e utilisateur·rice WhatsApp.
 *        1. Parse le payload → extrait from/text/timestamp/messageId
 *        2. Construit un anonymousId stable à partir du numéro ("wa:<from>")
 *        3. Appelle le pipeline Sankofa partagé (red flag → TPE → RAG → LLM → safety)
 *        4. Renvoie la réponse via sendWhatsAppMessage()
 *        5. Renvoie 200 ACK à Meta (même si l'envoi échoue — sinon Meta retry en boucle)
 *
 * Si env vars non posées, on renvoie quand même 200 (ne pas casser Meta) mais
 * on log un avertissement indiquant qu'on est en mode dev.
 *
 * Configurer le webhook dans le dashboard Meta Business avec :
 *   - Callback URL : https://<domain>/api/whatsapp/webhook
 *   - Verify Token : valeur de WHATSAPP_VERIFY_TOKEN
 *   - Souscrire aux champs : messages
 */

import { NextResponse } from "next/server";
import {
  isWhatsAppConfigured,
  parseIncomingMessage,
  sendWhatsAppMessage,
  verifyWebhook,
} from "@/lib/whatsapp";
import { processChatMessage } from "@/lib/chat-pipeline";

export const runtime = "nodejs";

/**
 * GET — vérification du webhook par Meta.
 *
 * Query params : hub.mode, hub.verify_token, hub.challenge
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode") ?? "";
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const verified = verifyWebhook(mode, token, challenge);
  if (verified !== null) {
    console.log("[WhatsApp] Webhook vérifié avec succès.");
    // Meta attend le challenge en plain text dans le body.
    return new Response(verified, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    "[WhatsApp] Webhook vérification échouée — mode/token invalides ou WHATSAPP_VERIFY_TOKEN absent.",
  );
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST — réception d'un message entrant.
 */
export async function POST(req: Request) {
  if (!isWhatsAppConfigured()) {
    console.warn(
      "[WhatsApp] Webhook POST reçu mais env vars non posées — mode dev, message ignoré.",
    );
    return NextResponse.json({ status: "ok", dev: true }, { status: 200 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error("[WhatsApp] Payload JSON invalide.");
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const incoming = parseIncomingMessage(body);
  if (!incoming) {
    // Pas un message utilisateur (status update, echo, etc.) — on ACK quand même.
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  console.log(
    `[WhatsApp] Incoming from ${incoming.from}: "${incoming.text.slice(0, 80)}..."`,
  );

  try {
    // anonymousId stable basé sur le numéro WhatsApp — permet de conserver
    // l'historique de conversation cross-canal (web + WhatsApp) si on le souhaite.
    // Ici on préfixe "wa:" pour éviter collision avec les UUID web.
    const anonymousId = `wa:${incoming.from}`;

    const result = await processChatMessage({
      message: incoming.text,
      anonymousId,
      persona: "grande_soeur",
    });

    // Renvoie la réponse à l'utilisateur·rice via WhatsApp.
    await sendWhatsAppMessage({ to: incoming.from, text: result.reply });

    console.log(
      `[WhatsApp] Reply sent to ${incoming.from} (triage=${result.triageLevel}, tpe=${result.tpeActivated}, redFlag=${result.redFlagTopic ?? "none"})`,
    );
  } catch (err) {
    console.error("[WhatsApp] Pipeline error:", err);
    // Tente une réponse de repli générique pour ne pas laisser l'utilisateur·rice sans réponse.
    await sendWhatsAppMessage({
      to: incoming.from,
      text:
        "Je suis désolé·e, j'ai un souci technique pour te répondre là. " +
        "Si c'est urgent, appelle le 185 (SAMU) ou le 143 (écoute). Reviens dans quelques minutes. 🤍",
    });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
