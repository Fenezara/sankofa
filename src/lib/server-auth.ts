/**
 * Sankofa — Server-side auth helper.
 *
 * Récupère la session serveur (NextAuth JWT) et retourne le userId si authentifié.
 * Utilisé par les API routes qui nécessitent un utilisateur connecté
 * (carnet sync, reminders, user/me, user/delete).
 *
 * Usage :
 *   import { getAuthenticatedUserId } from "@/lib/server-auth";
 *   const userId = await getAuthenticatedUserId();
 *   if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/next-auth";

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    return userId ?? null;
  } catch {
    return null;
  }
}
