/**
 * POST /api/teleconsultation/book
 *
 * Réserve une téléconsultation avec un médecin ivoirien partenaire.
 * Body: { anonymousId, tier: 'teleconsultation'|'family', preferredTime?, symptoms? }
 * Response: { bookingId, scheduledAt, meetingUrl, doctorName?, doctorSpecialty?, amount, status }
 *
 * Flow :
 *  1. Vérifie auth + subscription (tier teleconsultation requiert paiement 3000 F)
 *  2. Crée la Téléconsultation en DB (status pending)
 *  3. Génère un meeting URL Jitsi (format : https://meet.jit.si/sankofa-{id})
 *  4. (TODO production) Notifie le médecin partenaire + envoie reminder
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

interface BookRequestBody {
  anonymousId?: string;
  tier?: "teleconsultation" | "family";
  preferredTime?: string;
  symptoms?: string;
}

const PRICING: Record<"teleconsultation" | "family", number> = {
  teleconsultation: 3000,
  family: 5000,
};

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentification requise pour la téléconsultation." },
      { status: 401 },
    );
  }

  let body: BookRequestBody;
  try {
    body = (await req.json()) as BookRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const anonymousId = (body.anonymousId ?? "").trim();
  const tier = body.tier === "family" ? "family" : "teleconsultation";
  const amount = PRICING[tier];

  // preferredTime : optionnel, défaut = dans 24h
  let scheduledAt: Date;
  if (body.preferredTime) {
    const d = new Date(body.preferredTime);
    if (isNaN(d.getTime()) || d.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "preferredTime doit être une date future valide." },
        { status: 400 },
      );
    }
    scheduledAt = d;
  } else {
    scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
  }

  const symptoms = body.symptoms?.trim().slice(0, 500) || null;

  try {
    const booking = await db.teleconsultation.create({
      data: {
        userId,
        anonymousId,
        tier,
        amount,
        scheduledAt,
        symptoms,
        status: "pending",
        // Meeting URL Jitsi (gratuit, no API key needed)
        meetingUrl: `https://meet.jit.si/sankofa-${Date.now().toString(36)}`,
        meetingId: `sankofa-${Date.now().toString(36)}`,
      },
    });

    console.log(
      `[Sankofa teleconsult] Booking ${booking.id} for user ${userId} · ${tier} · ${amount} F · ${scheduledAt.toISOString()}`,
    );

    return NextResponse.json({
      bookingId: booking.id,
      scheduledAt: booking.scheduledAt,
      meetingUrl: booking.meetingUrl,
      meetingId: booking.meetingId,
      amount,
      tier,
      status: "pending",
      message: "Téléconsultation réservée. Un médecin confirmera sous 24h. Tu recevras un rappel 1h avant.",
    });
  } catch (err) {
    console.error("[Sankofa teleconsult/book] Error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la réservation." },
      { status: 500 },
    );
  }
}
