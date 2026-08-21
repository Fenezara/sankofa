/**
 * POST /api/analytics/track
 *
 * Tracking événements anonymes pour amélioration produit.
 * Privacy-safe : anonymousId seulement, aucune PII, opt-out possible.
 *
 * Body: {
 *   anonymousId: string,
 *   event: string,          // 'tab_change'|'suggestion_click'|'quiz_completed'|'feedback_given'|'audio_used'|'sentinel_check_in'|'testimony_shared'|'cycle_logged'
 *   properties?: object,   // event-specific (max 10 keys, values stringifiable)
 * }
 *
 * Response: { ok: true }
 *
 * Rate limit : 60 events/min/anonyme (anti-spam).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

const VALID_EVENTS = [
  "tab_change",
  "suggestion_click",
  "quiz_completed",
  "quiz_correct",
  "quiz_wrong",
  "feedback_given",
  "audio_used",
  "audio_transcribed",
  "audio_spoken",
  "sentinel_check_in",
  "testimony_shared",
  "testimony_hearted",
  "cycle_logged",
  "carnet_entry_saved",
  "companion_activated",
  "persona_switched",
  "transparency_viewed",
] as const;

interface TrackRequestBody {
  anonymousId?: string;
  event?: string;
  properties?: Record<string, unknown>;
}

// Simple rate limit en mémoire (par anonymousId)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

export async function POST(req: Request) {
  let body: TrackRequestBody;
  try {
    body = (await req.json()) as TrackRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const anonymousId = (body.anonymousId ?? "").trim();
  const event = body.event as (typeof VALID_EVENTS)[number];

  if (!anonymousId) {
    return NextResponse.json(
      { error: "anonymousId est requis." },
      { status: 400 },
    );
  }
  if (!event || !VALID_EVENTS.includes(event)) {
    return NextResponse.json(
      { error: `Event invalide. Valid: ${VALID_EVENTS.join(", ")}` },
      { status: 400 },
    );
  }

  // Rate limit
  const now = Date.now();
  const rl = rateLimitMap.get(anonymousId);
  if (rl && now < rl.resetAt) {
    if (rl.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Rate limit dépassé (60/min)." },
        { status: 429 },
      );
    }
    rl.count++;
  } else {
    rateLimitMap.set(anonymousId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // Properties : max 10 keys, stringify values
  const rawProps = body.properties ?? {};
  const propKeys = Object.keys(rawProps).slice(0, 10);
  const safeProps: Record<string, string> = {};
  for (const k of propKeys) {
    try {
      safeProps[k] = String(rawProps[k]).slice(0, 200);
    } catch {
      // ignore
    }
  }

  const userId = await getAuthenticatedUserId();

  try {
    await db.analyticsEvent.create({
      data: {
        anonymousId,
        userId: userId ?? null,
        event,
        properties: JSON.stringify(safeProps),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Sankofa analytics/track] Error:", err);
    // Non-bloquant : on renvoie OK même si DB échoue (analytics ne doit pas casser l'app)
    return NextResponse.json({ ok: true });
  }
}
