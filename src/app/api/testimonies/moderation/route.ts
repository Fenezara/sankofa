/**
 * GET /api/testimonies/moderation
 * PATCH /api/testimonies/moderation
 *
 * File de modération des témoignages anonymes (admin only).
 * Nécessite une authentification (admin only — TODO: check role admin).
 *
 * GET — liste les témoignages en attente de modération
 *   Query:
 *     ?status=pending   — filtre par statut (pending | approved | rejected) — défaut pending
 *     ?limit=50         — pagination
 *     ?offset=0
 *   Response: {
 *     testimonies: Testimony[], // inclut anonymousId (pour détection abuse pattern)
 *     total: number,
 *     hasMore: boolean
 *   }
 *
 * PATCH — approuve ou rejette un témoignage
 *   Body: {
 *     id: string,
 *     action: 'approve' | 'reject'
 *   }
 *   Response: { ok: true, status: 'approved' | 'rejected', moderatedAt: string }
 *
 * Note : les témoignages rejetés ne sont PAS supprimés — ils restent en DB
 * (status="rejected") pour audit + détection d'abus (un anonymousId qui
 * spamme des contenus hors charte peut être identifié).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

const VALID_STATUSES = ["pending", "approved", "rejected"] as const;

interface ModerationRequestBody {
  id?: string;
  action?: string;
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentification admin requise." },
      { status: 401 },
    );
  }
  // TODO: vérifier que l'utilisateur est admin (role-based — pas encore implémenté)

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "pending";
  const status = VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])
    ? statusParam
    : "pending";
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  try {
    const [testimonies, total] = await Promise.all([
      db.testimony.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          anonymousId: true,
          domain: true,
          title: true,
          content: true,
          ageRange: true,
          status: true,
          hearts: true,
          reportedCount: true,
          createdAt: true,
          moderatedAt: true,
        },
      }),
      db.testimony.count({ where: { status } }),
    ]);

    return NextResponse.json({
      testimonies,
      total,
      hasMore: offset + testimonies.length < total,
    });
  } catch (err) {
    console.error("[Sankofa moderation GET] Error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentification admin requise." },
      { status: 401 },
    );
  }
  // TODO: vérifier que l'utilisateur est admin (role-based — pas encore implémenté)

  let body: ModerationRequestBody;
  try {
    body = (await req.json()) as ModerationRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const id = (body.id ?? "").trim();
  const action = body.action;

  if (!id) {
    return NextResponse.json({ error: "id est requis." }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: 'action doit être "approve" ou "reject".' },
      { status: 400 },
    );
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  try {
    const existing = await db.testimony.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Témoignage introuvable." }, { status: 404 });
    }

    const updated = await db.testimony.update({
      where: { id },
      data: {
        status: newStatus,
        moderatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        moderatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (err) {
    console.error("[Sankofa moderation PATCH] DB error:", err);
    return NextResponse.json({ error: "Erreur de persistance." }, { status: 500 });
  }
}
