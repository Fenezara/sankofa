/**
 * GET /api/chat/suggestions?context=xxx&hour=14&persona=grande_soeur
 *
 * Suggestions dynamiques selon le contexte (heure, persona, historique récent).
 * Remplace la liste statique SUGGESTIONS dans chat.tsx par des suggestions adaptatives.
 *
 * Response: {
 *   suggestions: Array<{ label, emoji, domain }>,
 *   context: { hour, period, persona }
 * }
 *
 * Logique :
 *  - Matin (6-11h) : nutrition, énergie, routine
 *  - Après-midi (12-17h) : productivité, stress, peau
 *  - Soir (18-22h) : sommeil, réflexion, santé sexuelle
 *  - Nuit (23-5h) : urgences, anxiété nocturne, insomnie
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Suggestion {
  label: string;
  emoji: string;
  domain: "SSR" | "Addictologie" | "Dermatologie" | "Santé mentale" | "Nutrition";
}

const SUGGESTIONS_BY_PERIOD: Record<string, Suggestion[]> = {
  morning: [
    { label: "Comment bien commencer ma journée ?", emoji: "☀️", domain: "Nutrition" },
    { label: "J'ai oublié ma pilule hier soir", emoji: "💊", domain: "SSR" },
    { label: "Petit-déj équilibré pas cher ?", emoji: "🍌", domain: "Nutrition" },
    { label: "Je me sens fatigué·e même après le sommeil", emoji: "😴", domain: "Santé mentale" },
  ],
  afternoon: [
    { label: "Brûlure en urinant, c'est grave ?", emoji: "🔥", domain: "SSR" },
    { label: "Stress pour mes examens", emoji: "📚", domain: "Santé mentale" },
    { label: "Crème éclaircissante, danger ?", emoji: "🧴", domain: "Dermatologie" },
    { label: "J'ai de l'acné, que faire ?", emoji: "😌", domain: "Dermatologie" },
  ],
  evening: [
    { label: "Rapport non protégé hier soir", emoji: "⚠️", domain: "SSR" },
    { label: "Je me sens triste tout le temps", emoji: "🤍", domain: "Santé mentale" },
    { label: "Comment arrêter le tabac ?", emoji: "🚬", domain: "Addictologie" },
    { label: "Je n'arrive pas à dormir", emoji: "🌙", domain: "Santé mentale" },
  ],
  night: [
    { label: "Je fais une crise d'angoisse", emoji: "💔", domain: "Santé mentale" },
    { label: "Je me sens seul·e ce soir", emoji: "🌙", domain: "Santé mentale" },
    { label: "Mon préservatif a craqué", emoji: "💥", domain: "SSR" },
    { label: "J'ai pris trop de tramadol", emoji: "💊", domain: "Addictologie" },
  ],
};

function getPeriod(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const hourParam = url.searchParams.get("hour");
  const persona = url.searchParams.get("persona");

  // Heure : param URL ou heure serveur
  let hour: number;
  if (hourParam) {
    hour = parseInt(hourParam, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) hour = new Date().getHours();
  } else {
    hour = new Date().getHours();
  }

  const period = getPeriod(hour);
  let suggestions = SUGGESTIONS_BY_PERIOD[period];

  // Personnalisation légère selon persona (Tonton Koffi = plus médical)
  if (persona === "tonton_medecin") {
    suggestions = [
      { label: "Quels examens faire pour un dépistage IST ?", emoji: "🔬", domain: "SSR" },
      ...suggestions.slice(0, 3),
    ];
  }

  return NextResponse.json({
    suggestions,
    context: {
      hour,
      period,
      persona: persona ?? "grande_soeur",
    },
  });
}
