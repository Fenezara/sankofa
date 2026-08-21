/**
 * Sankofa — Mode Compagnon de trajet
 *
 * Après un TPE ou un red flag, Sankofa reste avec l'utilisateur·rice pendant
 * son trajet vers la structure de santé. Check-ins périodiques, encouragement,
 * aide pratique.
 *
 * Les messages sont PRÉ-ÉCRITS (pas de LLM) pour garantir la sécurité :
 * empathiques mais contrôlés. Aucune réponse générée ne doit dériver vers
 * des conseils médicaux non validés sur un sujet sensible.
 *
 * Persistance : localStorage (clé `aya:companion`) — < 1 KB.
 */

import type { RedFlagTopic } from "@/lib/guardrails";

export interface CompanionState {
  active: boolean;
  startedAt: number;
  trigger: "tpe" | "red_flag" | "manual";
  redFlagTopic?: RedFlagTopic;
  stage: "departing" | "in_transit" | "arrived" | "completed" | "cancelled";
  lastCheckIn: number;
  checkInCount: number;
}

export const COMPANION_STORAGE_KEY = "aya:companion";

/** Intervalle entre check-ins — 45s pour la démo (10 min en production). */
export const COMPANION_CHECK_IN_INTERVAL_MS = 45_000;

/** Nombre max de check-ins sans réponse avant auto-annulation. */
export const COMPANION_MAX_CHECK_INS = 5;

export const INITIAL_COMPANION_STATE: CompanionState = {
  active: false,
  startedAt: 0,
  trigger: "manual",
  stage: "departing",
  lastCheckIn: 0,
  checkInCount: 0,
};

/**
 * Catalogue de messages de check-in par trigger + topic.
 *
 * 5 messages par scénario :
 *  - index 0 : activation (T+0)
 *  - index 1 : T+45s
 *  - index 2 : T+90s
 *  - index 3 : T+135s
 *  - index 4 : T+180s
 *
 * Après le 5e message sans réponse → message d'auto-annulation.
 */
const CHECK_IN_MESSAGES: Record<"tpe" | "red_flag", Record<string, string[]>> = {
  tpe: {
    default: [
      "On est ensemble. Tu vas y arriver. 🌿",
      "Tu es toujours là ? Tu as pu trouver comment y aller ?",
      "Tu as encore le temps. Le TPE est efficace dans les 72h. 🌿 Tu veux l'adresse d'un centre ?",
      "Tu y es presque ? Si tu es arrivé·e, dis-moi « je suis arrivé·e » pour que je note ça dans ton carnet.",
      "Je m'inquiète un peu. Si tu ne peux pas y aller tout de suite, appelle le 185 ou le 143. Je reste là.",
    ],
  },
  red_flag: {
    viol: [
      "On est ensemble. Tu n'es pas seul·e. Ce n'est pas de ta faute. 🤍",
      "Tu es toujours là ? Tu as pu contacter quelqu'un ? Le 110 ou le 143 sont là 24/7.",
      "Respire. Tu as pu trouver comment y aller ? Le CHU de Cocody ou Treichville peut t'accueillir.",
      "Tu y es presque ? Si tu es arrivé·e, dis-moi « je suis arrivé·e » pour que je note ça dans ton carnet.",
      "Je m'inquiète un peu. Si tu ne peux pas y aller tout de suite, appelle le 143. Je reste là.",
    ],
    suicide: [
      "On est ensemble. Tu as eu raison d'en parler. 🤍",
      "Tu es toujours là ? Je m'inquiète pour toi. Le 143 est gratuit et anonyme. Tu peux appeler maintenant.",
      "Respire. Chaque minute compte. Tu veux que je reste avec toi pendant que tu appelles ?",
      "Tu y es presque ? Si tu es en sécurité maintenant, dis-moi « je suis arrivé·e » ou « je vais mieux ».",
      "Je m'inquiète un peu. Si tu vas mal, appelle le 143 tout de suite. Je reste là. 🤍",
    ],
    avortement: [
      "On est ensemble. Tu n'es pas seul·e face à ça. 🤍",
      "Tu es toujours là ? Tu as pu contacter l'AIBEF ? 27 22 44 09 09.",
      "Respire. Ils vont t'écouter sans juger. Tu veux que je t'aide à trouver le centre le plus proche ?",
      "Tu y es presque ? Si tu as parlé à quelqu'un, dis-moi « je suis arrivé·e » pour que je note ça.",
      "Je reste là. Reviens quand tu veux. 🤍",
    ],
    urgence_vitale: [
      "On est ensemble. Agis maintenant. 🤍",
      "Tu es toujours là ? Appelle le 185 (SAMU) si ce n'est pas déjà fait.",
      "Ne reste pas seul·e. Fais-toi accompagner si tu peux.",
      "Tu es pris·e en charge ? Dis-moi « je suis arrivé·e » pour que je suive.",
      "Je m'inquiète un peu. Si tu ne peux pas bouger, appelle le 185. Je reste là.",
    ],
    mineur_en_danger: [
      "On est ensemble. Tu fais bien de parler. 🤍",
      "Tu es toujours là ? Le 143 peut t'orienter vers la protection de l'enfance.",
      "Respire. Il faut qu'un adulte formé protège l'enfant. Tu veux le numéro ?",
      "Tu as pu contacter quelqu'un ? Dis-moi « je suis arrivé·e » si c'est fait.",
      "Je m'inquiète un peu. Appelle le 143 ou le 110. Je reste là. 🤍",
    ],
    violence_conjugale: [
      "On est ensemble. Ce n'est pas de ta faute. 🤍",
      "Tu es toujours là ? Tu es en sécurité maintenant ? Le 143 est là 24/7.",
      "Respire. Prépare tes papiers si tu peux. Le 110 si tu es en danger immédiat.",
      "Tu as pu contacter quelqu'un ? Dis-moi « je suis arrivé·e » si tu es en lieu sûr.",
      "Je m'inquiète un peu. Appelle le 110 si tu es en danger. Je reste là. 🤍",
    ],
    addiction: [
      "On est ensemble. Tu as eu raison de parler. 🤍",
      "Tu es toujours là ? Le 143 peut t'orienter vers les services addictologie.",
      "Respire. Le sevrage non encadré peut être dangereux. Ne reste pas seul·e.",
      "Tu as pu contacter quelqu'un ? Dis-moi « je suis arrivé·e » si c'est fait.",
      "Je m'inquiète un peu. Si tu te sens mal physiquement, appelle le 185. Je reste là. 🤍",
    ],
    mutilation_genitale: [
      "On est ensemble. Personne n'a le droit de te faire ça. 🤍",
      "Tu es toujours là ? Le 143 peut t'aider. Tu es en sécurité maintenant ?",
      "Respire. Parle à un·e adulte de confiance si tu peux. Tu n'es pas seul·e.",
      "Tu as pu contacter quelqu'un ? Dis-moi « je suis arrivé·e » si tu es en lieu sûr.",
      "Je m'inquiète un peu. Appelle le 110 si tu es en danger. Je reste là. 🤍",
    ],
    overdose: [
      "On est ensemble. Ne reste pas seul·e. 🤍",
      "Tu es toujours là ? Appelle le 185 (SAMU) si ce n'est pas déjà fait. Garde l'emballage.",
      "Respire. Fais-toi accompagner par quelqu'un. Ne bois pas d'alcool.",
      "Tu es pris·e en charge ? Dis-moi « je suis arrivé·e » pour que je note ça.",
      "Je m'inquiète un peu. Si tu vas mal, appelle le 185 tout de suite. Je reste là. 🤍",
    ],
    trouble_alimentaire_grave: [
      "On est ensemble. Tu as eu raison de parler. 🤍",
      "Tu es toujours là ? Le 143 peut t'écouter, c'est gratuit et anonyme.",
      "Respire. Tu mérites d'être accompagné·e. Ton corps mérite d'être nourri.",
      "Tu as pu contacter quelqu'un ? Dis-moi « je suis arrivé·e » si c'est fait.",
      "Je m'inquiète un peu. Si tu es en détresse, appelle le 143. Je reste là. 🤍",
    ],
    default: [
      "On est ensemble. Tu vas y arriver. 🌿",
      "Tu es toujours là ? Tu as pu trouver comment y aller ?",
      "Respire. Tu veux que je t'aide à trouver le numéro du centre ?",
      "Tu y es presque ? Si tu es arrivé·e, dis-moi « je suis arrivé·e » pour que je note ça dans ton carnet.",
      "Je m'inquiète un peu. Si tu ne peux pas y aller tout de suite, appelle le 143. Je reste là.",
    ],
  },
};

/**
 * Retourne le message de check-in pour un trigger/topic/index donné.
 */
export function getCheckInMessage(
  trigger: "tpe" | "red_flag" | "manual",
  redFlagTopic: RedFlagTopic | undefined,
  index: number,
): string {
  if (index < 0) return "";
  const triggerKey: "tpe" | "red_flag" = trigger === "manual" ? "tpe" : trigger;
  const topicKey = redFlagTopic ?? "default";
  const messages =
    CHECK_IN_MESSAGES[triggerKey]?.[topicKey] ??
    CHECK_IN_MESSAGES[triggerKey]?.default ??
    CHECK_IN_MESSAGES.red_flag.default;
  return messages[Math.min(index, messages.length - 1)] ?? "";
}

/** Message envoyé quand le compagnon s'auto-annule (5 check-ins sans réponse). */
export const COMPANION_AUTO_CANCEL_MESSAGE =
  "Je vais m'arrêter là, mais je m'inquiète pour toi. Si tu vas mal, appelle le 143. Reviens quand tu veux. 🤍";

/** Message envoyé quand l'utilisateur·rice revient et que le mode compagnon est toujours actif. */
export const COMPANION_RESUME_MESSAGE = "Tu es revenu·e ! Je suis toujours là. 🌿";

export interface CompanionQuickAction {
  id: "en_route" | "arrived" | "parler" | "stop";
  label: string;
  emoji: string;
  ariaLabel: string;
}

export const COMPANION_QUICK_ACTIONS: CompanionQuickAction[] = [
  {
    id: "en_route",
    label: "Je suis en route",
    emoji: "🚶",
    ariaLabel: "Indiquer à Sankofa que je suis en route vers la structure",
  },
  {
    id: "arrived",
    label: "Je suis arrivé·e",
    emoji: "🏥",
    ariaLabel: "Indiquer à Sankofa que je suis arrivé·e à la structure",
  },
  {
    id: "parler",
    label: "J'ai besoin de parler",
    emoji: "💬",
    ariaLabel: "Demander à parler avec Sankofa",
  },
  {
    id: "stop",
    label: "Arrêter le mode compagnon",
    emoji: "✋",
    ariaLabel: "Arrêter le mode compagnon",
  },
];

/**
 * Réponse de Sankofa pour chaque quick action.
 */
export function getQuickActionResponse(
  actionId: CompanionQuickAction["id"],
): string {
  switch (actionId) {
    case "en_route":
      return "Bon courage. Tu vas y arriver. 🌿";
    case "arrived":
      return "🎉 Bravo ! Tu as fait le plus dur. Veux-tu que je sauve cette consultation dans ton carnet ?";
    case "parler":
      return "Je suis là. Dis-moi tout.";
    case "stop":
      return "D'accord, je m'arrête. Mais je reste là si tu as besoin. 🌿";
    default:
      return "";
  }
}

/**
 * Construit un libellé lisible pour le type de trigger (utilisé dans le carnet).
 */
export function getTriggerLabel(state: CompanionState): string {
  if (state.trigger === "tpe") return "TPE 72h";
  if (state.trigger === "red_flag" && state.redFlagTopic) {
    return `Sujet sensible (${state.redFlagTopic.replace(/_/g, " ")})`;
  }
  return "Accompagnement";
}

/* ---------- Persistence (localStorage) ---------- */

export function loadCompanionState(): CompanionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPANION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CompanionState>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.active) return null;
    return {
      active: true,
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : Date.now(),
      trigger: parsed.trigger === "red_flag" || parsed.trigger === "manual" ? parsed.trigger : "tpe",
      redFlagTopic: parsed.redFlagTopic,
      stage:
        parsed.stage === "in_transit" ||
        parsed.stage === "arrived" ||
        parsed.stage === "completed" ||
        parsed.stage === "cancelled"
          ? parsed.stage
          : "departing",
      lastCheckIn: typeof parsed.lastCheckIn === "number" ? parsed.lastCheckIn : Date.now(),
      checkInCount: typeof parsed.checkInCount === "number" ? parsed.checkInCount : 0,
    };
  } catch {
    return null;
  }
}

export function saveCompanionState(state: CompanionState): void {
  if (typeof window === "undefined") return;
  try {
    if (!state.active || state.stage === "completed" || state.stage === "cancelled") {
      window.localStorage.removeItem(COMPANION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage plein ou bloqué — non bloquant
  }
}

export function clearCompanionState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COMPANION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
