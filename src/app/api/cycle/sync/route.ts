/**
 * GET  /api/cycle/sync — Télécharge le cycle chiffré cloud (pull)
 * POST /api/cycle/sync — Upload le cycle chiffré cloud (push)
 *
 * Le cycle menstruel est CHIFFRÉ côté client (AES-256-GCM via Web Crypto,
 * exactement comme le carnet). Le serveur ne stocke que le blob chiffré + IV —
 * il ne peut JAMAIS lire le contenu (dates de règles, symptômes, flux, notes).
 *
 * POST body: {
 *   encryptedBlob: string,  // base64 — contient CycleEntry[] sérialisé JSON
 *   iv: string,              // base64 (12 bytes AES-GCM)
 *   cycleCount: number,      // nombre de cycles enregistrés (metadata publique)
 *   version?: number,        // default 1
 * }
 *
 * GET response: {
 *   cycle: { encryptedBlob, iv, version, cycleCount, updatedAt } | null
 * } (null si pas encore synchronisé)
 *
 * Conflit : si updatedAt serveur > updatedAt client, le client doit merger
 * (stratégie LWW côté client — le serveur ne fait que stocker le blob).
 *
 * Privacy by design : AUCUNE donnée médicale en clair côté serveur.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

interface SyncRequestBody {
  encryptedBlob?: string;
  iv?: string;
  cycleCount?: number;
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
    const cycle = await db.cycleSync.findUnique({
      where: { userId },
      select: {
        encryptedBlob: true,
        iv: true,
        version: true,
        cycleCount: true,
        updatedAt: true,
      },
    });

    if (!cycle) {
      return NextResponse.json({ cycle: null });
    }

    return NextResponse.json({ cycle });
  } catch (err) {
    console.error("[Sankofa cycle/sync GET] Error:", err);
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
  const cycleCount = typeof body.cycleCount === "number" ? body.cycleCount : 0;
  const version = typeof body.version === "number" ? body.version : 1;

  if (!encryptedBlob || !iv) {
    return NextResponse.json(
      { error: "encryptedBlob et iv sont requis." },
      { status: 400 },
    );
  }
  // Limite 2 MB (base64) — un cycle menstruel reste léger même sur plusieurs années
  if (encryptedBlob.length > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Données de cycle trop volumineuses (max 2 MB)." },
      { status: 413 },
    );
  }

  try {
    const cycle = await db.cycleSync.upsert({
      where: { userId },
      create: {
        userId,
        encryptedBlob,
        iv,
        version,
        cycleCount,
      },
      update: {
        encryptedBlob,
        iv,
        version,
        cycleCount,
      },
      select: {
        updatedAt: true,
        cycleCount: true,
        version: true,
      },
    });

    console.log(
      `[Sankofa cycle/sync] User ${userId}: ${cycleCount} cycles, v${version}`,
    );

    return NextResponse.json({
      ok: true,
      syncedAt: cycle.updatedAt,
      cycleCount: cycle.cycleCount,
      version: cycle.version,
    });
  } catch (err) {
    console.error("[Sankofa cycle/sync POST] Error:", err);
    return NextResponse.json(
      { error: "Erreur de persistance." },
      { status: 500 },
    );
  }
}
