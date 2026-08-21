/**
 * Web Push notifications via Web Push API (VAPID).
 *
 * Permet à Sankofa d envoyer des notifications push aux utilisateur·rice·s qui ont
 * accepté de les recevoir — typiquement :
 *   - "Ton plan d'action est prêt 🌿"
 *   - "Rappel : prise de pilule dans 30 min"
 *   - "Ta téléconsultation démarre dans 10 min"
 *
 * Requires env vars:
 *  - VAPID_PUBLIC_KEY   : clé publique (P-256, base64url)
 *  - VAPID_PRIVATE_KEY  : clé privée (P-256, base64url)
 *  - VAPID_SUBJECT      : mailto: ou https: (contact push service)
 *
 * Générer les clés : `npx web-push generate-vapid-keys`
 *
 * Tant que ces vars ne sont pas posées, `sendPushNotification()` retourne false
 * (dev mode), et `getVapidPublicKey()` retourne null — le client sait alors
 * qu'il ne doit pas proposer l'abonnement push.
 */

import webpush from "web-push";

let configured = false;

/**
 * Configure web-push avec les clés VAPID la première fois qu'on en a besoin.
 * Idempotent — ne reconfigure pas si déjà fait.
 */
function configure(): void {
  if (configured) return;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@aya.ci",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    configured = true;
  }
}

/**
 * Indique si les clés VAPID sont posées.
 * Permet au client de savoir s'il peut proposer l'abonnement push.
 */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  /** URL à ouvrir au clic sur la notif (optionnel). */
  url?: string;
  /** Tag pour grouper/remplacer les notifs (optionnel). */
  tag?: string;
}

/**
 * Envoie une notification push à un·e abonné·e.
 *
 * @returns true si envoyée, false si erreur (ou dev mode).
 */
export async function sendPushNotification(
  subscription: PushSubscriptionInput,
  payload: PushPayload,
): Promise<boolean> {
  configure();
  if (!configured) {
    console.warn(
      "[Push] Missing VAPID env vars — notification not sent (dev mode). " +
        "Génère les clés avec `npx web-push generate-vapid-keys` et pose-les en env.",
    );
    return false;
  }
  try {
    await webpush.sendNotification(
      subscription as unknown as webpush.PushSubscription,
      JSON.stringify(payload),
    );
    return true;
  } catch (err: unknown) {
    // 404 / 410 = subscription expirée ou invalide — à supprimer en base.
    const status =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : 0;
    if (status === 404 || status === 410) {
      console.warn(
        `[Push] Subscription ${subscription.endpoint} expirée (${status}) — à supprimer.`,
      );
    } else {
      console.error("[Push] Send failed:", err);
    }
    return false;
  }
}

/**
 * Renvoie la clé publique VAPID (pour le client qui s'abonne).
 * Null en dev mode (clés non posées).
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}
