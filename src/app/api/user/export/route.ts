/**
 * GET /api/user/export
 *
 * Exporte toutes les données personnelles de l'utilisateur (RGPD Art. 20 — portabilité).
 * Nécessite auth.
 *
 * Response: JSON avec :
 *   - user (phoneMasked, name, createdAt)
 *   - conversations (anonymizedId, messages, timestamps)
 *   - feedbacks
 *   - reminders
 *   - carnetSync (encrypted blob, pas déchiffré — l'utilisateur a la clé)
 *   - cycleSync (encrypted blob)
 *   - teleconsultations
 *   - analyticsEvents
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié·e." }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        phoneMasked: true,
        name: true,
        subscriptionTier: true,
        subscriptionUntil: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }

    const [conversations, feedbacks, reminders, carnetSync, cycleSync, teleconsultations, analyticsEvents] =
      await Promise.all([
        db.conversation.findMany({
          where: { userId },
          include: { messages: { select: { role: true, content: true, triageLevel: true, createdAt: true } } },
        }),
        db.feedback.findMany({
          where: { anonymousId: { startsWith: userId.slice(0, 8) } },
          select: { thumb: true, comment: true, emotion: true, persona: true, createdAt: true },
          take: 100,
        }),
        db.reminder.findMany({ where: { userId } }),
        db.carnetSync.findUnique({ where: { userId }, select: { encryptedBlob: true, iv: true, entryCount: true, updatedAt: true } }),
        db.cycleSync.findUnique({ where: { userId }, select: { encryptedBlob: true, iv: true, cycleCount: true, updatedAt: true } }),
        db.teleconsultation.findMany({ where: { userId }, select: { scheduledAt: true, status: true, tier: true, amount: true, doctorName: true } }),
        db.analyticsEvent.findMany({
          where: { userId },
          select: { event: true, properties: true, createdAt: true },
          take: 500,
        }),
      ]);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      user,
      conversations: conversations.map((c) => ({
        anonymousId: c.anonymousId,
        createdAt: c.createdAt,
        messageCount: c.messages.length,
        messages: c.messages,
      })),
      feedbacks,
      reminders: reminders.map((r) => ({
        type: r.type,
        title: r.title,
        message: r.message,
        scheduledFor: r.scheduledFor,
        status: r.status,
      })),
      carnetSync: carnetSync
        ? { ...carnetSync, note: "Blob chiffré AES-256-GCM. Utilise ta clé locale pour déchiffrer." }
        : null,
      cycleSync: cycleSync
        ? { ...cycleSync, note: "Blob chiffré AES-256-GCM. Utilise ta clé locale pour déchiffrer." }
        : null,
      teleconsultations,
      analyticsEvents: analyticsEvents.map((e) => ({
        event: e.event,
        properties: e.properties,
        createdAt: e.createdAt,
      })),
      note: "Conformément au RGPD Art. 20 (portabilité), ces données sont exportées en JSON. Les blobs chiffrés (carnet, cycle) ne peuvent être lus qu'avec ta clé locale (Web Crypto).",
    });
  } catch (err) {
    console.error("[Sankofa user/export] Error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
