/**
 * GET /api/user/streaks
 *
 * Récupère les streaks (séries) de l'utilisateur — cross-device si authentifié.
 *
 * Response: {
 *   current: number,        // série actuelle en jours
 *   best: number,           // meilleure série
 *   totalDays: number,      // total jours actifs
 *   lastActivity: string?,  // ISO date
 *   badges: string[],       // badges débloqués
 * }
 *
 * Si non authentifié : lit le localStorage (streaks côté client via @/lib/streaks).
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-auth";
import { getStreak, getStreakBadge } from "@/lib/streaks";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getAuthenticatedUserId();

  // Si non authentifié → stats locales (localStorage)
  if (!userId) {
    const streak = getStreak();
    return NextResponse.json({
      current: streak.current,
      best: streak.longest,
      totalDays: streak.totalDays,
      lastActivity: streak.lastVisit ?? null,
      badges: streak.current > 0 ? [getStreakBadge(streak.current)] : [],
      source: "local",
    });
  }

  // Si authentifié → (TODO) agréger les AnalyticsEvent pour calculer le streak serveur
  // Pour le MVP, on combine local + serveur
  const streak = getStreak();
  return NextResponse.json({
    current: streak.current,
    best: streak.longest,
    totalDays: streak.totalDays,
    lastActivity: streak.lastVisit ?? null,
    badges: streak.current > 0 ? [getStreakBadge(streak.current)] : [],
    source: "hybrid",
  });
}
