/**
 * GET /api/quiz/stats
 *
 * Statistiques quiz agrégées (pour admin ou user dashboard).
 *
 * Query:
 *   ?anonymousId=xxx — filtre par utilisateur anonyme (ses propres stats)
 *
 * Response: {
 *   totalAnswered, correctCount, accuracy,
 *   byDomain: { SSR: {total, correct, accuracy}, ... },
 *   weeklyActivity: [{date, answered, correct}]
 * }
 *
 * Privacy-safe : agrégat seulement, pas de contenu de message.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Le quiz est principalement client-side (localStorage).
  // Cette API retourne des stats simulées/agrégées pour le MVP.
  // En production : persistance des résultats quiz en DB (table QuizResult).

  return NextResponse.json({
    note: "Les stats quiz sont stockées localement (localStorage) pour le MVP.",
    localStorageKeys: [
      "sankofa:quiz-{YYYY-MM-DD} — réponse du jour",
      "sankofa:quiz-week-{YYYY-WW} — progression hebdomadaire",
      "sankofa:quiz-stats — agrégat cumulé",
    ],
    integration: "Pour récupérer les stats côté client :",
    clientSide: {
      totalAnswered: "localStorage.getItem('sankofa:quiz-stats-total')",
      correctCount: "localStorage.getItem('sankofa:quiz-stats-correct')",
      accuracy: "correct / total * 100",
      byDomain: "voir sankofa:quiz-stats-by-domain (JSON)",
      streak: "via @/lib/streaks (getStreak)",
    },
  });
}
