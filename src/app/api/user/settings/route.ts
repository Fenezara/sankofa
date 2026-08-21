/**
 * GET  /api/user/settings — récupère les préférences utilisateur
 * PUT  /api/user/settings — met à jour les préférences
 *
 * Préférences stockées directement sur le User (pas de modèle séparé pour MVP) :
 *   - preferredPersona : 'grande_soeur' | 'grand_frere' | 'tonton_medecin'
 *   - language : 'fr' (seul pour l'instant, audio Dioula/Baoulé bientôt)
 *   - notificationsEnabled : boolean
 *   - analyticsOptIn : boolean (défaut true)
 *
 * Response GET: { preferredPersona, language, notificationsEnabled, analyticsOptIn }
 * Body PUT: { preferredPersona?, language?, notificationsEnabled?, analyticsOptIn? }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const runtime = "nodejs";

const VALID_PERSONAS = ["grande_soeur", "grand_frere", "tonton_medecin"] as const;

interface SettingsRequestBody {
  preferredPersona?: string;
  language?: string;
  notificationsEnabled?: boolean;
  analyticsOptIn?: boolean;
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié·e." }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, subscriptionTier: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }

    // Les préférences sont stockées dans une PushSubscription-like metadata
    // Pour le MVP, on utilise localStorage côté client + un settings JSON sur le User
    // (à étendre avec un modèle UserSettings si besoin)
    return NextResponse.json({
      name: user.name,
      subscriptionTier: user.subscriptionTier,
      // Côté client, ces prefs sont aussi en localStorage pour fonctionner hors-ligne
      note: "Les préférences UI (persona, langue, notifications) sont stockées en localStorage côté client pour le MVP.",
      localStorageKeys: [
        "sankofa:preferred-persona",
        "sankofa:notifications-enabled",
        "sankofa:analytics-opt-in",
        "aya:persona",
      ],
    });
  } catch (err) {
    console.error("[Sankofa user/settings GET] Error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié·e." }, { status: 401 });
  }

  let body: SettingsRequestBody;
  try {
    body = (await req.json()) as SettingsRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  // Valider preferredPersona si fourni
  if (body.preferredPersona && !VALID_PERSONAS.includes(body.preferredPersona as (typeof VALID_PERSONAS)[number])) {
    return NextResponse.json(
      { error: `preferredPersona invalide. Valid: ${VALID_PERSONAS.join(", ")}` },
      { status: 400 },
    );
  }

  // Pour le MVP, on renvoie OK — les préférences sont stockées côté client
  // En production : étendre le modèle User avec colonnes dédiées ou modèle UserSettings
  return NextResponse.json({
    ok: true,
    note: "Préférences stockées côté client (localStorage). Le serveur ne persiste pas encore ces champs pour le MVP.",
    received: body,
  });
}
