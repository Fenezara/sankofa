/**
 * POST /api/sentinel/check
 *
 * IA Sentinelle Préventive — Sankofa reaches out first.
 *
 * Analyse le pattern émotionnel d'une série de messages récents et décide si
 * Sankofa doit envoyer un check-in proactif (message doux pré-écrit).
 *
 * Privacy-safe :
 *  - Aucune persistance serveur (pas de DB, pas de log du contenu).
 *  - Analyse 100% in-memory via lib/sentinel.ts.
 *  - L'état de la sentinelle (déjà checké aujourd'hui ?) vit côté client
 *    (localStorage) dans chat.tsx → SentinelCheck.
 *
 * Body: {
 *   anonymousId: string,
 *   recentMessages: [{role, content, ts, emotion?}]
 * }
 *
 * Response: {
 *   trend: "improving"|"stable"|"declining"|"critical",
 *   signals: string[],
 *   recommendation: string,        // pour analytics/logs, pas affiché brut
 *   shouldCheckIn: boolean,
 *   suggestedMessage?: string,      // message doux à envoyer si shouldCheckIn
 *   analyzedAt: number              // ts serveur (UTC ms)
 * }
 */

import { NextResponse } from "next/server";
import {
  analyzeEmotionalPattern,
  type SentinelMessage,
} from "@/lib/sentinel";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface CheckRequestBody {
  anonymousId?: string;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
    ts: number;
    emotion?:
      | "détresse"
      | "anxieux"
      | "triste"
      | "colère"
      | "honte"
      | "neutre";
  }>;
}

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 4000;

export async function POST(req: Request) {
  let body: CheckRequestBody;
  try {
    body = (await req.json()) as CheckRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const anonymousId = (body.anonymousId ?? "").trim();
  if (!anonymousId) {
    return NextResponse.json(
      { error: 'Le paramètre "anonymousId" est requis.' },
      { status: 400 },
    );
  }

  // Rate-limit : 10 analyses/minute par utilisateur (la sentinelle tourne côté
  // client toutes les 5 messages ou sur focus — c'est largement suffisant).
  const rl = rateLimit(`sentinel:${anonymousId}`, 10, 60000);
  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Trop de requêtes sentinelle. Réessaie dans quelques secondes.",
        retryIn: rl.resetIn,
      },
      { status: 429 },
    );
  }

  // Validation des messages entrants.
  const rawMsgs = Array.isArray(body.recentMessages) ? body.recentMessages : [];
  if (rawMsgs.length === 0) {
    return NextResponse.json({
      trend: "stable",
      signals: ["no_messages"],
      recommendation:
        "Aucun message fourni pour analyse. Pas de check-in proactif.",
      shouldCheckIn: false,
      analyzedAt: Date.now(),
    });
  }

  // Sanitize : on plafonne le nombre + la longueur de chaque message.
  const messages: SentinelMessage[] = rawMsgs
    .slice(-MAX_MESSAGES)
    .filter(
      (m) =>
        m &&
        typeof m.content === "string" &&
        typeof m.ts === "number" &&
        (m.role === "user" || m.role === "assistant"),
    )
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      ts: m.ts,
      emotion: m.emotion,
    }));

  // Analyse 100% locale (aucune donnée envoyée à un service externe).
  const pattern = analyzeEmotionalPattern(messages, Date.now());

  // On ne renvoie pas les messages eux-mêmes (privacy by design).
  return NextResponse.json({
    trend: pattern.trend,
    signals: pattern.signals,
    recommendation: pattern.recommendation,
    shouldCheckIn: pattern.shouldCheckIn,
    suggestedMessage: pattern.suggestedMessage,
    analyzedAt: Date.now(),
    analyzedMessageCount: messages.length,
  });
}
