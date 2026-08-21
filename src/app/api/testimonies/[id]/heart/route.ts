/**
 * POST /api/testimonies/[id]/heart
 *
 * Toggle cœur sur un témoignage (Pair-Aidant Lite — "Tu n'es pas seul·e").
 * - Si pas de cœur existant → ajoute + incrémente `hearts` sur Testimony.
 * - Si cœur existant → retire + décrémente `hearts` (toggle).
 * - Utilise la contrainte @@unique([testimonyId, anonymousId]) pour empêcher
 *   les double-cœurs (idempotent).
 *
 * Body: { anonymousId: string }
 *
 * Response: {
 *   hearted: boolean,    // true si cœur posé, false si retiré
 *   hearts: number       // nouveau total
 * }
 *
 * Privacy by design :
 *   - anonymousId seulement (jamais l'identité réelle)
 *   - pas de cookie / IP stockée
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface HeartRequestBody {
  anonymousId?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: HeartRequestBody;
  try {
    body = (await req.json()) as HeartRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const anonymousId = (body.anonymousId ?? "").trim();
  if (!anonymousId || anonymousId.length > 100) {
    return NextResponse.json({ error: "anonymousId requis." }, { status: 400 });
  }

  // Le témoignage doit exister et être approved pour être aimable.
  try {
    const testimony = await db.testimony.findUnique({
      where: { id },
      select: { id: true, status: true, hearts: true },
    });

    if (!testimony) {
      return NextResponse.json({ error: "Témoignage introuvable." }, { status: 404 });
    }
    if (testimony.status !== "approved") {
      return NextResponse.json(
        { error: "Ce témoignage n'est pas encore publié." },
        { status: 403 },
      );
    }

    // Cherche un cœur existant (unique sur [testimonyId, anonymousId])
    const existing = await db.testimonyHeart.findUnique({
      where: {
        testimonyId_anonymousId: { testimonyId: id, anonymousId },
      },
    });

    if (existing) {
      // Retire le cœur (toggle off)
      await db.$transaction([
        db.testimonyHeart.delete({ where: { id: existing.id } }),
        db.testimony.update({
          where: { id },
          data: { hearts: { decrement: 1 } },
        }),
      ]);
      const updated = await db.testimony.findUnique({
        where: { id },
        select: { hearts: true },
      });
      return NextResponse.json({ hearted: false, hearts: Math.max(0, updated?.hearts ?? 0) });
    }

    // Pose le cœur (toggle on)
    await db.$transaction([
      db.testimonyHeart.create({
        data: { testimonyId: id, anonymousId },
      }),
      db.testimony.update({
        where: { id },
        data: { hearts: { increment: 1 } },
      }),
    ]);
    const updated = await db.testimony.findUnique({
      where: { id },
      select: { hearts: true },
    });
    return NextResponse.json({ hearted: true, hearts: updated?.hearts ?? 1 });
  } catch (err) {
    console.error("[Sankofa testimonies heart] DB error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
