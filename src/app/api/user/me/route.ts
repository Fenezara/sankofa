/**
 * GET /api/user/me
 *
 * Retourne le profil de l'utilisateur authentifié.
 * Nécessite une session valide (NextAuth JWT).
 *
 * Response: {
 *   id, phoneMasked, name?, subscriptionTier?, subscriptionUntil?, createdAt
 * }
 *
 * Privacy-safe : ne renvoie JAMAIS phoneHash ni données brutes.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Non authentifié·e." },
      { status: 401 },
    );
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneMasked: true,
        name: true,
        subscriptionTier: true,
        subscriptionUntil: true,
        createdAt: true,
        _count: {
          select: {
            conversations: true,
            reminders: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur·rice introuvable." },
        { status: 404 },
      );
    }

    const carnetSync = await db.carnetSync.findUnique({
      where: { userId },
      select: { updatedAt: true, entryCount: true, version: true },
    });

    return NextResponse.json({
      ...user,
      carnetSync: carnetSync
        ? {
            lastSyncAt: carnetSync.updatedAt,
            entryCount: carnetSync.entryCount,
            version: carnetSync.version,
          }
        : null,
    });
  } catch (err) {
    console.error("[Sankofa user/me] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}
