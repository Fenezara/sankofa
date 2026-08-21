/**
 * GET /api/admin/feedback
 *
 * Statistiques agrégées des feedbacks utilisateur (👍/👎).
 * Nécessite une authentification (admin only — TODO: check role admin).
 *
 * Query:
 *   ?days=30        — fenêtre temporelle (défaut 30 jours)
 *   ?persona=xxx    — filtre par persona
 *   ?emotion=xxx    — filtre par émotion
 *
 * Response: {
 *   total, thumbsUp, thumbsDown, approvalRate,
 *   byPersona: { grande_soeur: {total, up, down, rate}, ... },
 *   byEmotion: { anxieux: {total, up, down, rate}, ... },
 *   byTriage: { info: {...}, orientation: {...}, urgence: {...} },
 *   recentNegative: [{messagePreview, emotion, persona, createdAt}] — 10 derniers 👎
 * }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

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
  const days = parseInt(url.searchParams.get("days") ?? "30", 10) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const feedbacks = await db.feedback.findMany({
      where: { createdAt: { gte: since } },
      select: {
        thumb: true,
        persona: true,
        emotion: true,
        triageLevel: true,
        messagePreview: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    const total = feedbacks.length;
    const thumbsUp = feedbacks.filter((f) => f.thumb === "up").length;
    const thumbsDown = feedbacks.filter((f) => f.thumb === "down").length;
    const approvalRate = total > 0 ? Math.round((thumbsUp / total) * 100) : 0;

    // Agrégat par persona
    const byPersona: Record<string, { total: number; up: number; down: number; rate: number }> = {};
    for (const f of feedbacks) {
      const key = f.persona ?? "unknown";
      if (!byPersona[key]) byPersona[key] = { total: 0, up: 0, down: 0, rate: 0 };
      byPersona[key].total++;
      if (f.thumb === "up") byPersona[key].up++;
      else byPersona[key].down++;
    }
    for (const k of Object.keys(byPersona)) {
      byPersona[k].rate = byPersona[k].total > 0
        ? Math.round((byPersona[k].up / byPersona[k].total) * 100)
        : 0;
    }

    // Agrégat par émotion
    const byEmotion: Record<string, { total: number; up: number; down: number; rate: number }> = {};
    for (const f of feedbacks) {
      const key = f.emotion ?? "neutre";
      if (!byEmotion[key]) byEmotion[key] = { total: 0, up: 0, down: 0, rate: 0 };
      byEmotion[key].total++;
      if (f.thumb === "up") byEmotion[key].up++;
      else byEmotion[key].down++;
    }
    for (const k of Object.keys(byEmotion)) {
      byEmotion[k].rate = byEmotion[k].total > 0
        ? Math.round((byEmotion[k].up / byEmotion[k].total) * 100)
        : 0;
    }

    // Agrégat par triage level
    const byTriage: Record<string, { total: number; up: number; down: number; rate: number }> = {};
    for (const f of feedbacks) {
      const key = f.triageLevel ?? "info";
      if (!byTriage[key]) byTriage[key] = { total: 0, up: 0, down: 0, rate: 0 };
      byTriage[key].total++;
      if (f.thumb === "up") byTriage[key].up++;
      else byTriage[key].down++;
    }
    for (const k of Object.keys(byTriage)) {
      byTriage[k].rate = byTriage[k].total > 0
        ? Math.round((byTriage[k].up / byTriage[k].total) * 100)
        : 0;
    }

    // 10 derniers feedbacks négatifs (pour analyse qualitative)
    const recentNegative = feedbacks
      .filter((f) => f.thumb === "down")
      .slice(0, 10)
      .map((f) => ({
        messagePreview: f.messagePreview,
        emotion: f.emotion,
        persona: f.persona,
        createdAt: f.createdAt,
      }));

    return NextResponse.json({
      window: { days, since, until: new Date() },
      total,
      thumbsUp,
      thumbsDown,
      approvalRate,
      byPersona,
      byEmotion,
      byTriage,
      recentNegative,
    });
  } catch (err) {
    console.error("[Sankofa admin/feedback] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}
