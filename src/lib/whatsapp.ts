/**
 * WhatsApp Business Cloud API client.
 *
 * Permet à Sankofa de répondre aux jeunes directement dans WhatsApp — le canal
 * où ils sont déjà — au lieu de les forcer à ouvrir l'app web.
 *
 * Requires env vars:
 *  - WHATSAPP_TOKEN            : token d'accès permanent (Meta Business)
 *  - WHATSAPP_PHONE_NUMBER_ID  : ID du numéro WhatsApp Business
 *  - WHATSAPP_VERIFY_TOKEN     : token personnalisé pour vérifier le webhook
 *
 * Tant que ces vars ne sont pas posées, toutes les méthodes tombent en mode
 * "dev mode" : pas de message envoyé, pas d'erreur fatale, log d'avertissement.
 * Cela permet à l'app de tourner en preview sans clés.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_API = "https://graph.facebook.com/v18.0";

export interface WhatsAppMessage {
  /** Numéro de téléphone avec indicatif pays, sans le +. Ex: "2250701020304". */
  to: string;
  text: string;
}

/**
 * Indique si les variables d'environnement WhatsApp sont posées.
 * Permet aux routes API de décider du mode dev vs production sans lever d'erreur.
 */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

/**
 * Envoie un message texte WhatsApp à un numéro.
 *
 * @returns true si le message a bien été envoyé, false sinon (mode dev ou erreur).
 */
export async function sendWhatsAppMessage({
  to,
  text,
}: WhatsAppMessage): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn(
      "[WhatsApp] Missing env vars — message not sent (dev mode). " +
        "Pose WHATSAPP_TOKEN et WHATSAPP_PHONE_NUMBER_ID pour activer l'envoi réel.",
    );
    return false;
  }

  try {
    const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[WhatsApp] Send failed:", res.status, errBody);
      return false;
    }

    const data = await res.json();
    const messageId = data?.messages?.[0]?.id;
    console.log(`[WhatsApp] Message envoyé à ${to} (id=${messageId ?? "?"})`);
    return true;
  } catch (err) {
    console.error("[WhatsApp] Send error:", err);
    return false;
  }
}

/**
 * Vérifie le webhook WhatsApp (challenge GET).
 *
 * WhatsApp envoie `hub.mode`, `hub.verify_token`, `hub.challenge` quand on
 * configure le webhook dans le dashboard Meta. On doit répondre `challenge`
 * en 200 si le verify_token correspond.
 *
 * @returns le challenge à renvoyer dans le body si OK, null sinon.
 */
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string,
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    console.warn(
      "[WhatsApp] WHATSAPP_VERIFY_TOKEN non posé — webhook ne peut être vérifié.",
    );
    return null;
  }
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}

export interface WhatsAppIncoming {
  /** Numéro de l'expéditeur (format international, sans +). */
  from: string;
  text: string;
  /** Timestamp epoch en millisecondes. */
  timestamp: number;
  /** ID du message WhatsApp (pour déduplication). */
  messageId: string;
}

/**
 * Extrait un message entrant du payload du webhook WhatsApp.
 *
 * Le payload a la structure :
 * ```
 * { entry: [{ changes: [{ value: { messages: [{ from, text, timestamp, id }] } ] }] }
 * ```
 *
 * @returns le message parsé, ou null si ce n'est pas un message utilisateur
 *          (peut être un statut, un echo, etc.).
 */
export function parseIncomingMessage(body: unknown): WhatsAppIncoming | null {
  try {
    const entry = (body as any)?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return null;
    return {
      from: message.from,
      text: message.text?.body ?? "",
      timestamp: Number(message.timestamp) * 1000,
      messageId: message.id,
    };
  } catch {
    return null;
  }
}
