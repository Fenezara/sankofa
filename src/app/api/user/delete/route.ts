/**
 * DELETE /api/user/delete
 *
 * Supprime le compte utilisateur + TOUTES ses données (droit à l'oubli).
 * Loi CI 2013 (ARTCI) + GDPR Article 17 — droit à l'effacement.
 *
 * Body optionnel: { reason?: string } — pour audit (anonymisé)
 *
 * Cascade : supprime User → cascade automatique Prisma (Account, Session,
 * CarnetSync, Reminder). Les Conversation restent (anonymes, liées à
 * anonymousId pas à userId) — on supprime aussi les Conversation.userId.
 *
 * Les Feedback restent (anonymes, liés à anonymousId seulement) — on les
 * conserve pour l'apprentissage agrégé (privacy-safe).
 *
 * Response: { ok: true, deleted: true }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

interface DeleteRequestBody {
  reason?: string;
}

export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Non authentifié·e." },
      { status: 401 },
    );
  }

  let reason: string | null = null;
  try {
    const body = (await req.json()) as DeleteRequestBody;
    if (body.reason) reason = body.reason.slice(0, 200);
  } catch {
    // Body optionnel — ignore si pas de JSON
  }

  try {
    // Détache les conversations anonymes (conserve l'historique anonymisé)
    // — userId mis à null, anonymousId conservé
    await db.conversation.updateMany({
      where: { userId },
      data: { userId: null },
    });

    // Supprime le User + cascade (Account, Session, CarnetSync, Reminder)
    await db.user.delete({
      where: { id: userId },
    });

    console.log(
      `[Sankofa user/delete] Compte ${userId} supprimé${reason ? ` (raison: ${reason})` : ""}`,
    );

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    console.error("[Sankofa user/delete] Error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la suppression." },
      { status: 500 },
    );
  }
}
