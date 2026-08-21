/**
 * POST /api/auth/otp/send (Task 12)
 *
 * Body: { phone: string }
 * Response: { success: true, masked: string, channel: "whatsapp" | "dev" }
 *
 * Flow:
 *   1. Normalise + valide le numéro (E.164, préfixe ivoirien 01/05/07).
 *   2. Rate limit : max 3 OTP / heure / phoneHash (compte les OTP créés dans la dernière heure).
 *   3. Génère un code 6 chiffres, le hash avec bcrypt, persiste dans OtpCode (TTL 10 min).
 *   4. Envoie via WhatsApp si WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID sont posés
 *      (réutilise src/lib/whatsapp.ts → sendWhatsAppMessage).
 *   5. Fallback dev : log le code dans la console (pour tests preview sans clés Meta).
 *
 * Privacy:
 *   - Le numéro en clair n'est JAMAIS persisté. On stocke uniquement phoneHash.
 *   - Le masked phone est renvoyé au client pour affichage UI.
 *   - Le code est hashé avec bcrypt avant stockage.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  normalizePhone,
  hashPhone,
  maskPhone,
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  OTP_RATE_LIMIT_PER_HOUR,
} from "@/lib/auth";
import { sendWhatsAppMessage, isWhatsAppConfigured } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const rawPhone = (body.phone ?? "").trim();
  const normalized = normalizePhone(rawPhone);
  if (!normalized) {
    return NextResponse.json(
      {
        error:
          "Numéro invalide. Format attendu : +225 suivi de 10 chiffres (ex: +225 07 01 02 03 04).",
      },
      { status: 400 },
    );
  }

  const phoneHash = hashPhone(normalized);
  const masked = maskPhone(normalized);

  // === Rate limit : max 3 OTP / heure / phoneHash ===
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentOtps = await db.otpCode.count({
    where: {
      phoneHash,
      createdAt: { gt: oneHourAgo },
    },
  });
  if (recentOtps >= OTP_RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      {
        error:
          "Trop de codes demandés. Réessaie dans une heure, ou vérifie tes SMS/WhatsApp.",
      },
      { status: 429 },
    );
  }

  // === Génère + hash le code ===
  const code = generateOtp();
  const hashedCode = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.otpCode.create({
    data: {
      phoneHash,
      code: hashedCode,
      expiresAt,
    },
  });

  // === Envoi du code ===
  let channel: "whatsapp" | "dev";
  if (isWhatsAppConfigured()) {
    // Numéro WhatsApp : format international sans le "+"
    const waTo = normalized.replace("+", "");
    const waText = `Sankofa — Ton code de vérification est : ${code}\n\nIl expire dans 10 minutes. Ne le partage avec personne.\n\n— L équipe Sankofa 🌿`;
    const sent = await sendWhatsAppMessage({ to: waTo, text: waText });
    channel = sent ? "whatsapp" : "dev";
    if (!sent) {
      // WhatsApp configuré mais échec d'envoi → fallback dev (log console)
      console.log(
        `[Sankofa OTP] WhatsApp send failed — fallback dev. Phone=${masked} Code=${code}`,
      );
    }
  } else {
    // Mode dev : pas de clés WhatsApp → on log le code côté serveur
    console.log(`[Sankofa OTP] DEV MODE — Phone=${masked} Code=${code}`);
    channel = "dev";
  }

  return NextResponse.json({
    success: true,
    masked,
    channel,
    expiresInMs: OTP_TTL_MS,
  });
}
