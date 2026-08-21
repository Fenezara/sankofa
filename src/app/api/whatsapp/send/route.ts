/**
 * POST /api/whatsapp/send
 *
 * Envoie un message WhatsApp sortant (rappels, follow-ups).
 * Utilise WhatsApp Business Cloud API (Meta).
 *
 * Body: {
 *   to: string,         // numéro E.164 (ex: "+2250701020304")
 *   template?: string,  // template name (pre-approved by Meta)
 *   text?: string,      // OR plain text (max 1024 chars)
 *   language?: string,  // default "fr"
 * }
 *
 * Response: { ok: true, messageId } | { ok: false, error }
 *
 * Si env vars non posées → simulation (log seulement).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

interface SendRequestBody {
  to?: string;
  template?: string;
  text?: string;
  language?: string;
}

function isValidPhone(phone: string): boolean {
  // E.164 format : +[country][number], max 15 digits
  const e164 = /^\+?[1-9]\d{1,14}$/;
  return e164.test(phone.replace(/\s/g, ""));
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Auth requise." }, { status: 401 });
  }

  let body: SendRequestBody;
  try {
    body = (await req.json()) as SendRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const to = (body.to ?? "").trim();
  const text = (body.text ?? "").trim();
  const template = body.template?.trim();
  const language = body.language ?? "fr";

  if (!to || !isValidPhone(to)) {
    return NextResponse.json(
      { error: "Numéro 'to' invalide (format E.164 attendu, ex: +2250701020304)." },
      { status: 400 },
    );
  }
  if (!text && !template) {
    return NextResponse.json(
      { error: "Soit 'text' soit 'template' est requis." },
      { status: 400 },
    );
  }
  if (text && text.length > 1024) {
    return NextResponse.json(
      { error: "Texte trop long (max 1024 caractères)." },
      { status: 413 },
    );
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Dev mode : si pas de token, simuler
  if (!token || !phoneNumberId) {
    console.log(
      `[Sankofa WhatsApp] (DEV SIMULATION) to=${to} text=${text?.slice(0, 80) ?? `[template: ${template}]`} lang=${language}`,
    );
    return NextResponse.json({
      ok: true,
      simulated: true,
      messageId: `sim-${Date.now()}`,
      message: "Mode dev — message non envoyé. Configurer WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID pour l'envoi réel.",
    });
  }

  try {
    // Production : appel API WhatsApp Cloud
    const payload = template
      ? {
          messaging_product: "whatsapp",
          to: to.replace("+", ""),
          type: "template",
          template: { name: template, language: { code: language } },
        }
      : {
          messaging_product: "whatsapp",
          to: to.replace("+", ""),
          type: "text",
          text: { body: text },
        };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Sankofa WhatsApp] API error:", response.status, errText);
      return NextResponse.json(
        { ok: false, error: `WhatsApp API error (${response.status})` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const messageId = data?.messages?.[0]?.id;

    console.log(`[Sankofa WhatsApp] Sent to ${to}: messageId=${messageId}`);
    return NextResponse.json({ ok: true, messageId });
  } catch (err) {
    console.error("[Sankofa WhatsApp/send] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur d'envoi." },
      { status: 500 },
    );
  }
}
