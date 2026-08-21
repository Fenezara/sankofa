/**
 * POST /api/chat (V2 — Sankofa)
 *
 * Body: {
 *   message: string,
 *   history: {role, content}[],
 *   anonymousId: string,
 *   persona?: Persona,
 *   userId?: string | null  // Task 12 — optional. Si fourni, lie la conversation au User.
 * }
 * Response: { reply, triageLevel, tpeActivated?, protocolUsed?, redFlagTopic?, persona, register }
 *
 * Pipeline délégué à `src/lib/chat-pipeline.ts` (partagé avec le webhook WhatsApp).
 * Voir ce fichier pour le détail des étapes (red flag → TPE → RAG → LLM → safety → persistance).
 *
 * Anonymat par défaut : si userId est null/absent, la conversation reste anonyme
 * (comportement historique — pas de régression). Si userId est fourni, la conversation
 * est liée au User en DB (utile pour carnet sync, téléconsultation, abonnements).
 */

import { NextResponse } from "next/server";
import { processChatMessage } from "@/lib/chat-pipeline";

export const runtime = "nodejs";

interface ChatRequestBody {
  message?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  anonymousId?: string;
  persona?: "grande_soeur" | "grand_frere" | "tonton_medecin";
  userId?: string | null;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const message = (body.message ?? "").trim();
  const anonymousId = (body.anonymousId ?? "").trim();
  // userId optionnel — validé côté server via getServerSession si besoin (MVP : trust client).
  const userId = (body.userId ?? null)?.trim() || null;

  if (!message) {
    return NextResponse.json(
      { error: 'Le paramètre "message" est requis.' },
      { status: 400 },
    );
  }
  if (!anonymousId) {
    return NextResponse.json(
      { error: 'Le paramètre "anonymousId" est requis.' },
      { status: 400 },
    );
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: "Message trop long (max 4000 caractères)." },
      { status: 413 },
    );
  }

  const result = await processChatMessage({
    message,
    history: body.history,
    anonymousId,
    persona: body.persona,
    userId,
  });

  return NextResponse.json(result);
}
