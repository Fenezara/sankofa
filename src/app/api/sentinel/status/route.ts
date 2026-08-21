/**
 * GET /api/sentinel/status
 *
 * IA Sentinelle Préventive — statut émotionnel courant.
 *
 * Query: ?anonymousId=xxx[&force=1]
 *
 * Re-analyse les 7 derniers jours de messages depuis l'historique de chat existant
 * (Conversation + Message tables). Cache in-memory 5 min par anonymousId pour éviter
 * de re-scanner la DB à chaque sondage UI (ex: header badge).
 *
 * Privacy-safe :
 *  - Aucune PII renvoyée (jamais le contenu des messages).
 *  - Seul le résultat agrégé (trend, signals, lastEmotion, counts) est renvoyé.
 *  - Cache in-memory pur — purgé au redémarrage serveur, jamais persisté sur disque.
 *
 * Response: {
 *   trend: "improving"|"stable"|"declining"|"critical",
 *   signals: string[],
 *   shouldCheckIn: boolean,
 *   lastEmotion?: Emotion,
 *   lastMessageAt?: number,        // ts UTC ms
 *   messageCount7d: number,
 *   cachedAt: number,              // ts UTC ms (analyse la plus récente)
 *   cached: boolean                 // true si servi depuis cache
 * }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  analyzeEmotionalPattern,
  scoreLastMessage,
  type SentinelMessage,
} from "@/lib/sentinel";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** TTL du cache in-memory : 5 minutes. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Fenêtre d'analyse : 7 jours (alignée sur lib/sentinel.ts). */
const ANALYSIS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Nb max de messages lus depuis la DB. */
const MAX_DB_MESSAGES = 60;

interface StatusCacheEntry {
  trend: "improving" | "stable" | "declining" | "critical";
  signals: string[];
  shouldCheckIn: boolean;
  lastEmotion?: string;
  lastMessageAt?: number;
  messageCount7d: number;
  cachedAt: number;
}

const statusCache = new Map<string, StatusCacheEntry>();

/**
 * Récupère les messages récents (7 derniers jours) d'une conversation anonyme.
 * Map sur le format SentinelMessage (sans exposer la DB).
 */
async function fetchRecentMessages(anonymousId: string): Promise<SentinelMessage[]> {
  const cutoff = new Date(Date.now() - ANALYSIS_WINDOW_MS);
  try {
    const conversation = await db.conversation.findUnique({
      where: { anonymousId },
      select: {
        messages: {
          where: { createdAt: { gte: cutoff } },
          orderBy: { createdAt: "asc" },
          take: MAX_DB_MESSAGES,
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) return [];

    return conversation.messages.map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as
        | "user"
        | "assistant",
      content: m.content,
      ts: m.createdAt.getTime(),
      // emotion n'est pas stocké en DB — sera recalculé par lib/sentinel via analyzeEmotion.
    }));
  } catch (err) {
    console.error("[Sankofa sentinel/status] DB error:", err);
    return [];
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const anonymousId = (url.searchParams.get("anonymousId") ?? "").trim();
  const forceRefresh = url.searchParams.get("force") === "1";

  if (!anonymousId) {
    return NextResponse.json(
      { error: 'Le paramètre "anonymousId" est requis.' },
      { status: 400 },
    );
  }

  // Rate-limit : 30 status checks/minute par utilisateur (cache aide beaucoup).
  const rl = rateLimit(`sentinel-status:${anonymousId}`, 30, 60000);
  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Trop de requêtes status. Réessaie dans quelques secondes.",
        retryIn: rl.resetIn,
      },
      { status: 429 },
    );
  }

  // === Cache hit (sauf si force=1) ===
  const now = Date.now();
  if (!forceRefresh) {
    const cached = statusCache.get(anonymousId);
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        trend: cached.trend,
        signals: cached.signals,
        shouldCheckIn: cached.shouldCheckIn,
        lastEmotion: cached.lastEmotion,
        lastMessageAt: cached.lastMessageAt,
        messageCount7d: cached.messageCount7d,
        cachedAt: cached.cachedAt,
        cached: true,
      });
    }
  }

  // === Re-analyse depuis l'historique DB ===
  const messages = await fetchRecentMessages(anonymousId);

  if (messages.length === 0) {
    const empty: StatusCacheEntry = {
      trend: "stable",
      signals: ["no_messages"],
      shouldCheckIn: false,
      messageCount7d: 0,
      cachedAt: now,
    };
    statusCache.set(anonymousId, empty);
    return NextResponse.json({
      trend: empty.trend,
      signals: empty.signals,
      shouldCheckIn: false,
      messageCount7d: 0,
      cachedAt: now,
      cached: false,
    });
  }

  const pattern = analyzeEmotionalPattern(messages, now);

  // Score du dernier message user pour exposer lastEmotion au UI.
  const lastUserMsg = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const lastScore = lastUserMsg
    ? scoreLastMessage(lastUserMsg)
    : undefined;

  const entry: StatusCacheEntry = {
    trend: pattern.trend,
    signals: pattern.signals,
    shouldCheckIn: pattern.shouldCheckIn,
    lastEmotion: lastScore?.emotion,
    lastMessageAt: lastUserMsg?.ts,
    messageCount7d: messages.filter((m) => m.role === "user").length,
    cachedAt: now,
  };
  statusCache.set(anonymousId, entry);

  // Garbage-collect : on purge les entrées expirées (>2× TTL) pour éviter la croissance infinie.
  if (statusCache.size > 200) {
    const cutoffTs = now - 2 * CACHE_TTL_MS;
    for (const [k, v] of statusCache) {
      if (v.cachedAt < cutoffTs) statusCache.delete(k);
    }
  }

  return NextResponse.json({
    trend: entry.trend,
    signals: entry.signals,
    shouldCheckIn: entry.shouldCheckIn,
    lastEmotion: entry.lastEmotion,
    lastMessageAt: entry.lastMessageAt,
    messageCount7d: entry.messageCount7d,
    cachedAt: entry.cachedAt,
    cached: false,
  });
}
