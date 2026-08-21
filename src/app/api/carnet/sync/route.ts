/**
 * GET  /api/carnet/sync — Télécharge le carnet chiffré cloud (pull)
 * POST /api/carnet/sync — Upload le carnet chiffré cloud (push)
 *
 * Le carnet est CHIFFRÉ côté client (AES-256-GCM via Web Crypto).
 * Le serveur ne stocke que le blob chiffré + IV — ne peut JAMAIS lire le contenu.
 *
 * POST body: {
 *   encryptedBlob: string,  // base64
 *   iv: string,              // base64 (12 bytes)
 *   entryCount: number,
 *   version?: number,        // default 1
 * }
 *
 * GET response: {
 *   encryptedBlob, iv, version, entryCount, updatedAt
 * } | null (si pas encore synchronisé)
 *
 * Conflit : si updatedAt serveur > updatedAt client, le client doit merger
 * (stratégie LWW côté client — le serveur ne fait que stocker).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

interface SyncRequestBody {
  encryptedBlob?: string;
  iv?: string;
  entryCount?: number;
  version?: number;
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Non authentifié·e." },
      { status: 401 },
    );
  }

  try {
    const carnet = await db.carnetSync.findUnique({
      where: { userId },
      select: {
        encryptedBlob: true,
        iv: true,
        version: true,
        entryCount: true,
        updatedAt: true,
      },
    });

    if (!carnet) {
      return NextResponse.json({ carnet: null });
    }

    return NextResponse.json({ carnet });
  } catch (err) {
    console.error("[Sankofa carnet/sync GET] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Non authentifié·e." },
      { status: 401 },
    );
  }

  let body: SyncRequestBody;
  try {
    body = (await req.json()) as SyncRequestBody;
  } catch {
    return NextResponse.json(
      { error: "JSON invalide." },
      { status: 400 },
    );
  }

  const encryptedBlob = body.encryptedBlob?.trim();
  const iv = body.iv?.trim();
  const entryCount = typeof body.entryCount === "number" ? body.entryCount : 0;
  const version = typeof body.version === "number" ? body.version : 1;

  if (!encryptedBlob || !iv) {
    return NextResponse.json(
      { error: "encryptedBlob et iv sont requis." },
      { status: 400 },
    );
  }
  // Limite 5 MB (base64) — carnet peut être volumineux mais pas illimité
  if (encryptedBlob.length > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Carnet trop volumineux (max 5 MB)." },
      { status: 413 },
    );
  }

  try {
    const carnet = await db.carnetSync.upsert({
      where: { userId },
      create: {
        userId,
        encryptedBlob,
        iv,
        version,
        entryCount,
      },
      update: {
        encryptedBlob,
        iv,
        version,
        entryCount,
      },
      select: {
        updatedAt: true,
        entryCount: true,
        version: true,
      },
    });

    console.log(
      `[Sankofa carnet/sync] User ${userId}: ${entryCount} entries, v${version}`,
    );

    return NextResponse.json({
      ok: true,
      syncedAt: carnet.updatedAt,
      entryCount: carnet.entryCount,
      version: carnet.version,
    });
  } catch (err) {
    console.error("[Sankofa carnet/sync POST] Error:", err);
    return NextResponse.json(
      { error: "Erreur de persistance." },
      { status: 500 },
    );
  }
}
