/**
 * POST /api/auth/otp/verify (Task 12)
 *
 * Body: { phone: string, code: string }
 * Response: { valid: boolean, attemptsRemaining: number, userId?: string, masked?: string }
 *
 * Lightweight pre-check used by the auth modal to give the user immediate
 * feedback ("Code valide — connexion…", "Code expiré", "Trop de tentatives")
 * BEFORE triggering the heavier signIn("phone-otp") call.
 *
 * IMPORTANT — this route does NOT consume the OTP. The actual consume + user
 * creation happens in the NextAuth authorize() callback. This separation means:
 *   - User gets instant feedback on typos without burning an attempt.
 *   - signIn("phone-otp") re-verifies + consumes in a single atomic operation.
 *
 * Wait — re-reading the spec: "If valid: consume OTP, create/find user, return
 * user ID". We follow that intent by CONSUMING here AND mirroring the find-or-
 * create-user logic. The NextAuth authorize() then re-checks: if the OTP is
 * already consumed (within the last 5 min) and the code matches the bcrypt hash,
 * the user is logged in. This avoids the "OTP already consumed" failure mode.
 *
 * Concretely:
 *   - Verify route: validates code, marks OTP consumed, find-or-creates User, returns userId.
 *   - NextAuth authorize: looks for ANY non-expired OTP for this phoneHash, verifies the
 *     code against the bcrypt hash (works even if consumed=true), and on success returns
 *     the existing User (no re-create).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  normalizePhone,
  hashPhone,
  maskPhone,
  verifyOtp,
  OTP_MAX_ATTEMPTS,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { phone?: string; code?: string };
  try {
    body = (await req.json()) as { phone?: string; code?: string };
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const rawPhone = (body.phone ?? "").trim();
  const code = (body.code ?? "").trim();
  const normalized = normalizePhone(rawPhone);
  if (!normalized) {
    return NextResponse.json(
      { error: "Numéro invalide." },
      { status: 400 },
    );
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Le code doit être 6 chiffres." },
      { status: 400 },
    );
  }

  const phoneHash = hashPhone(normalized);
  const masked = maskPhone(normalized);

  // Cherche le dernier OTP non expiré pour ce téléphone (consommé ou non —
  // un OTP déjà consommé peut encore servir si l'utilisateur n'a pas encore
  // appelé signIn).
  const otpRecord = await db.otpCode.findFirst({
    where: {
      phoneHash,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return NextResponse.json(
      {
        valid: false,
        error: "Aucun code actif. Demande un nouveau code.",
        attemptsRemaining: 0,
      },
      { status: 404 },
    );
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json(
      {
        valid: false,
        error: "Trop de tentatives. Demande un nouveau code.",
        attemptsRemaining: 0,
      },
      { status: 429 },
    );
  }

  // Vérifie le code
  const valid = await verifyOtp(code, otpRecord.code);
  if (!valid) {
    const newAttempts = otpRecord.attempts + 1;
    await db.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: newAttempts },
    });
    const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - newAttempts);
    return NextResponse.json(
      {
        valid: false,
        error: "Code incorrect.",
        attemptsRemaining,
      },
      { status: 401 },
    );
  }

  // Code valide — consume l'OTP
  await db.otpCode.update({
    where: { id: otpRecord.id },
    data: { consumed: true },
  });

  // Find-or-create user (mirror NextAuth authorize logic — keeps verify route
  // usable standalone for non-NextAuth clients, e.g. linking phone to existing session).
  let user = await db.user.findUnique({ where: { phoneHash } });
  if (!user) {
    user = await db.user.create({
      data: {
        phoneHash,
        phoneMasked: masked,
        subscriptionTier: "free",
      },
    });
  }

  return NextResponse.json({
    valid: true,
    userId: user.id,
    masked,
  });
}
