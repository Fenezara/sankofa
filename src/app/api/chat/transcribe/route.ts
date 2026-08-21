/**
 * POST /api/chat/transcribe — Speech-to-Text (ASR)
 *
 * Body: multipart/form-data with an `audio` field (Blob/File from MediaRecorder,
 *       typically webm/opus or ogg/opus).
 * Response: { text: string } — the transcribed text.
 *
 * Uses z-ai-web-dev-sdk ASR capability (server-only — NEVER imported on the client).
 *
 * Why this matters for Sankofa: young Ivorians often speak Dioula/Baoulé/Nouchi
 * fluently but write them rarely. Voice input lets them ask their health question
 * out loud instead of forcing French text. The transcription is sent back to the
 * chat input field for review (never auto-sent — user keeps control).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// ASR can take a few seconds for long audio — give it room.
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Requête invalide — multipart/form-data attendu avec un champ `audio`." },
        { status: 400 },
      );
    }
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return NextResponse.json(
        { error: "Aucun fichier audio reçu (champ `audio` manquant)." },
        { status: 400 },
      );
    }

    // Form data values can be string or File. We need a File/Blob.
    if (typeof audioFile === "string" || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Le champ `audio` doit être un fichier binaire." },
        { status: 400 },
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Le fichier audio est vide." },
        { status: 400 },
      );
    }

    // Cap at ~10 MB to protect the API from accidental huge uploads.
    const MAX_BYTES = 10 * 1024 * 1024;
    if (audioFile.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Fichier audio trop volumineux (max 10 Mo)." },
        { status: 413 },
      );
    }

    // Convert Blob → base64 for the SDK.
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));
    const base64Audio = buffer.toString("base64");

    // Dynamic import — keeps z-ai-web-dev-sdk strictly server-side.
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const response = await zai.audio.asr.create({
      file_base64: base64Audio,
    });

    // The SDK returns a parsed object with a `text` field.
    const text =
      (response &&
        typeof response.text === "string" &&
        response.text.trim()) ||
      "";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[transcribe] ASR error:", error);
    const message =
      error instanceof Error ? error.message : "Échec de la transcription audio.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
