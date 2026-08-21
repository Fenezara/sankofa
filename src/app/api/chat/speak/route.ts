/**
 * POST /api/chat/speak — Text-to-Speech (TTS)
 *
 * Body: { text: string, persona?: "grande_soeur" | "grand_frere" | "tonton_medecin" }
 * Response: audio/wav binary stream.
 *
 * Uses z-ai-web-dev-sdk TTS capability (server-only — NEVER imported on the client).
 *
 * V4 — Phonetic pre-processing :
 *   Le SDK TTS ne propose que des voix chinoises. Pour améliorer la prononciation
 *   du français, le texte est d'abord pré-traité par le LLM en phonétique adaptée
 *   (voir @/lib/tts-phonetic.ts). Le résultat reste du français reconnaissable
 *   mais optimisé pour les voix chinoises.
 *
 * Voice mapping by persona (the underlying TTS engine exposes a fixed set of
 * voices, none of them West-African. We map each persona to the closest
 * emotional tone available):
 *   - grande_soeur   → "tongtong"   (warm, intimate)
 *   - grand_frere    → "xiaochen"   (calm, reassuring)
 *   - tonton_medecin → "luodo"      (deeper, authoritative)
 *
 * The text is capped at 500 characters (TTS is expensive and long monologues
 * are better split into multiple calls in a future iteration).
 */

import { NextResponse } from "next/server";
import { preprocessForTTS } from "@/lib/tts-phonetic";

export const runtime = "nodejs";
export const maxDuration = 30;

type Persona = "grande_soeur" | "grand_frere" | "tonton_medecin";

const VOICE_MAP: Record<Persona, string> = {
  grande_soeur: "tongtong",
  grand_frere: "xiaochen",
  tonton_medecin: "luodo",
};

const MAX_TEXT_LENGTH = 500;

interface SpeakRequestBody {
  text?: string;
  persona?: Persona;
}

export async function POST(req: Request) {
  try {
    let body: SpeakRequestBody;
    try {
      body = (await req.json()) as SpeakRequestBody;
    } catch {
      return NextResponse.json(
        { error: "Corps de requête invalide (JSON attendu)." },
        { status: 400 },
      );
    }

    const rawText = (body.text ?? "").trim();
    if (!rawText) {
      return NextResponse.json(
        { error: "Le paramètre `text` est requis." },
        { status: 400 },
      );
    }

    // Cap text length to keep TTS fast and predictable.
    const text = rawText.slice(0, MAX_TEXT_LENGTH);

    const persona: Persona =
      body.persona && VOICE_MAP[body.persona] ? body.persona : "grande_soeur";
    const voice = VOICE_MAP[persona];

    // === V4 : Phonetic pre-processing ===
    // Pré-traite le texte français pour améliorer la prononciation par la voix chinoise
    const phoneticText = await preprocessForTTS(text, persona);

    console.log(
      `[speak] TTS persona=${persona} voice=${voice} original=${text.length}chars phonetic=${phoneticText.length}chars`,
    );

    // Dynamic import — keeps z-ai-web-dev-sdk strictly server-side.
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const ttsResponse = await zai.audio.tts.create({
      input: phoneticText,
      voice,
      response_format: "wav",
      stream: false,
    });

    const arrayBuffer = await ttsResponse.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "TTS a renvoyé un audio vide." },
        { status: 502 },
      );
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[speak] TTS error:", error);
    const message =
      error instanceof Error ? error.message : "Échec de la synthèse vocale.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
