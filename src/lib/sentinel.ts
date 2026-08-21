/**
 * Sankofa — IA Sentinelle Préventive (V1)
 *
 * Sankofa PROACTIVELY reaches out first — not just reacts to messages.
 * This module analyzes emotional patterns over time across a user's recent
 * chat history and decides whether Sankofa should send a gentle proactive
 * check-in ("Je remarque que...").
 *
 * Privacy by design :
 *  - Analyse 100% locale (in-memory), aucun appel réseau, aucune donnée envoyée.
 *  - Ne persiste RIEN côté serveur : l'état de la sentinelle vit dans localStorage
 *    côté client (cf. SentinelCheck dans chat.tsx).
 *  - Utilise `analyzeEmotion` existant (lib/emotion.ts) pour le scoring par message
 *    quand l'émotion n'est pas déjà fournie par le pipeline chat.
 *
 * Patterns détectés :
 *  1. Declining mood over 7 days      → trend = "declining"
 *  2. Increasingly dark language       → trend = "declining" ou "critical"
 *  3. Isolation signals                → signal "isolation"
 *  4. Escalating anxiety               → signal "escalating_anxiety"
 *
 * Sortie :
 *  - trend: "improving" | "stable" | "declining" | "critical"
 *  - signals: string[]   (codes machine, ex. "declining_mood_7d")
 *  - recommendation: string  (phrase pour logs/analytics, jamais montrée brute)
 *  - shouldCheckIn: boolean
 *  - suggestedMessage?: string  (message doux pré-écrit à envoyer à l'utilisateur)
 *
 * Garde-fous :
 *  - trend="critical" ne déclenche JAMAIS un red flag ou une urgence médicale —
 *    on envoie un message doux ("tu comptes") sans alarmer.
 *  - Jamais de diagnostic, jamais de jugement.
 */

import { analyzeEmotion, type Emotion } from "@/lib/emotion";

/** Message entrant — format minimal accepté par la sentinelle. */
export interface SentinelMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  /** Optionnel : émotion déjà calculée par le pipeline chat (évite un re-scoring). */
  emotion?: Emotion;
}

export type EmotionalTrend = "improving" | "stable" | "declining" | "critical";

export interface EmotionalPattern {
  trend: EmotionalTrend;
  /** Codes machine décrivant les signaux détectés (pour analytics / debug). */
  signals: string[];
  /** Phrase humaine pour logs/analytics — ne pas afficher brute à l'utilisateur. */
  recommendation: string;
  /** True si Sankofa devrait initier un check-in proactif. */
  shouldCheckIn: boolean;
  /** Message doux pré-écrit à envoyer comme check-in (si shouldCheckIn). */
  suggestedMessage?: string;
}

/** Fenêtre d'analyse glissante : 7 jours. */
const ANALYSIS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Nb minimum de messages utilisateur pour qu'une analyse ait du sens. */
const MIN_MESSAGES_FOR_TREND = 3;
/** Nb max de messages utilisateur analysés (parf pour la perf + la pertinence). */
const MAX_MESSAGES_ANALYZED = 30;

/**
 * Poids "sombre" par émotion — plus c'est élevé, plus le message est lourd émotionnellement.
 * Utilisé pour calculer un "darkness score" par message puis une moyenne glissante.
 *
 * Note : "détresse" inclut idées noires, douleur morale intense — c'est le signal le plus grave.
 * Mais on reste doux dans la sortie (jamais d'alarme auto).
 */
const EMOTION_DARKNESS: Record<Emotion, number> = {
  détresse: 4,
  triste: 3,
  anxieux: 2,
  colère: 2,
  honte: 1,
  neutre: 0,
};

/** Markers de langage sombre (mots-clés bruts, en plus de l'analyse émotion). */
const DARK_LANGUAGE_MARKERS = [
  // Idées noires / désespoir
  "mourir", "mort", "suicide", "en finir", "plus rien", "desespoir", "désespoir",
  "abandonne", "abandon", "seul au monde", "personne ne", "je suis seul",
  "je hais ma vie", "je me deteste", "je me déteste", "mieux vaut disparaitre",
  "perdu", "perdue", "je suis perd", "ca ne sert a rien", "inutile",
  // Auto-dépréciation intense
  "je ne vaux rien", "je suis nul", "je suis bonne a rien", "bon a rien",
  // Isolement social
  "isole", "isolée", "isolee", "coupé du monde", "coupe du monde",
  "personne pour parler", "je n ai personne", "je n'ai personne",
  // Anxiété escaladante
  "panique", "etouffe", "étouffe", "suffoque", "crise d ang", "crise d'ang",
  "je vais devenir fou", "je vais devenir folle", "je perds la tete", "je perds la tête",
];

/** Markers spécifiques d'isolement social (signaux plus larges que le seul darkness). */
const ISOLATION_MARKERS = [
  "seul", "seule", "isole", "isolée", "isolee", "personne", "abandonne",
  "abandonnée", "abandonnee", "solitude", "solitaire", "coupé", "coupée",
  "coupe", "personne ne m ecoute", "personne ne m'écoute", "je n ai personne",
  "je n'ai personne", "sans ami", "sans amis", "rejeté", "rejetée", "rejetee",
];

/** Markers d'anxiété escaladante (en plus du scoring émotion). */
const ANXIETY_ESCALATION_MARKERS = [
  "panique", "angoisse", "anxieux", "anxiete", "anxiété", "stress", "stressant",
  "stressante", "peur", "angoissé", "angoissée", "angoisse", "angoisse",
  "etouffe", "étouffe", "suffoque", "palpitation", "tremblement",
  "boule au ventre", "je flippe", "je flippe grave", "trop peur",
];

/**
 * Normalise une chaîne (lowercase + strip accents + ponctuation) pour le matching de keywords.
 * Évite de rater "Triste." ou "DÉSEPOIR" à cause de la casse/accents.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compte combien de markers d'une liste apparaissent dans un texte normalisé. */
function countMarkers(text: string, markers: string[]): number {
  const norm = normalize(text);
  if (!norm) return 0;
  let count = 0;
  for (const m of markers) {
    if (norm.includes(normalize(m))) count++;
  }
  return count;
}

/** Calcule un "darkness score" 0-1 pour un message utilisateur unique. */
function messageDarkness(msg: SentinelMessage): number {
  const emotion: Emotion = msg.emotion ?? analyzeEmotion(msg.content).emotion;
  const base = EMOTION_DARKNESS[emotion] ?? 0;
  // Les markers ajoutent du poids mais sont plafonnés (max +2 points).
  const darkMarkers = countMarkers(msg.content, DARK_LANGUAGE_MARKERS);
  const total = base + Math.min(2, darkMarkers * 0.5);
  // Normalisation 0-1 (max théorique = 4 détresse + 2 markers = 6).
  return Math.min(1, total / 6);
}

/** Moyenne simple d'un tableau de nombres. */
function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Sélectionne les messages utilisateur sur la fenêtre d'analyse (7 derniers jours),
 * triés chronologiquement, plafonnés à MAX_MESSAGES_ANALYZED.
 * Ignore les messages assistant (Sankofa) et les timestamps nuls (welcome).
 */
function selectRecentUserMessages(
  messages: SentinelMessage[],
  now: number = Date.now(),
): SentinelMessage[] {
  const cutoff = now - ANALYSIS_WINDOW_MS;
  return messages
    .filter((m) => m.role === "user" && m.ts > 0 && m.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts)
    .slice(-MAX_MESSAGES_ANALYZED);
}

/**
 * Messages pré-écrits pour chaque type de check-in.
 * Ces messages sont DOUX, jamais alarmants, jamais alarme médicale.
 * Préfixés par "Je remarque que..." ou similaire pour signaler la proactivité.
 */
const PROACTIVE_MESSAGES: Record<EmotionalTrend, string[]> = {
  improving: [], // Pas de check-in si ça va mieux.
  stable: [], // Pas de check-in si stable.
  declining: [
    "Je remarque que tu sembles moins bien ces derniers jours. Je suis là si tu veux parler. 🌿",
    "Je sens que c'est un peu dur en ce moment. On peut en parler quand tu veux — zéro jugement. 🤍",
  ],
  critical: [
    "Je veux juste te dire que tu comptes. Quoi qu'il arrive. 🤍",
    "Je suis là, tu n'es pas seul·e avec ça. Je reste à côté. 🌿",
  ],
};

/** Choisit un message doux selon le trend + un signal dominant (déterministe par session). */
function pickProactiveMessage(
  trend: EmotionalTrend,
  signals: string[],
  salt = 0,
): string | undefined {
  // Priorité 1 : critical → message doux "tu comptes" (jamais alarmant).
  // On le met AVANT isolation/anxiety car c'est le cas le plus grave — on ne veut
  // PAS envoyer "Tu n'as pas beaucoup parlé" à quelqu'un en détresse profonde.
  if (trend === "critical") {
    const criticalArr = PROACTIVE_MESSAGES.critical;
    if (criticalArr.length > 0) {
      const idx = Math.abs(salt + signals.length) % criticalArr.length;
      return criticalArr[idx];
    }
  }
  // Priorité 2 : signal spécifique (anxiety > isolation) → message ciblé.
  if (signals.includes("escalating_anxiety")) {
    return "Je sens que tu es stressé·e en ce moment. On peut en parler si tu veux — zéro jugement. 🤍";
  }
  if (signals.includes("isolation")) {
    return "Tu n'as pas beaucoup parlé ces temps-ci. Tout va bien ? Je reste là. 🌿";
  }
  // Sinon : message générique du trend (declining).
  const arr = PROACTIVE_MESSAGES[trend];
  if (!arr || arr.length === 0) return undefined;
  // Déterministe par salt + nb signaux (évite le flicker entre deux messages
  // si l'analyse est re-demandée dans la même session).
  const idx = Math.abs(salt + signals.length) % arr.length;
  return arr[idx];
}

/**
 * Analyse le pattern émotionnel d'une liste de messages récents.
 *
 * @param messages Tous les messages récents (user + assistant). Seuls les user sont analysés.
 * @param now Timestamp de référence (defaults to Date.now()). Passer un now fixe pour tests.
 *
 * Étapes :
 *  1. Filtrer les messages user des 7 derniers jours.
 *  2. Si < MIN_MESSAGES_FOR_TREND → trend="stable" (pas assez de data).
 *  3. Calculer un darkness score par message.
 *  4. Splitter en "early half" (première moitié chronologique) vs "recent half".
 *  5. Comparer les moyennes → trend improving / stable / declining.
 *  6. Détecter les signaux isolation / escalating_anxiety.
 *  7. Si darkness récent très élevé ou détresse répétée → trend="critical".
 *  8. shouldCheckIn = true si trend ∈ {declining, critical} et signaux suffisants.
 *  9. suggestedMessage choisi selon trend + signal dominant.
 */
export function analyzeEmotionalPattern(
  messages: SentinelMessage[],
  now: number = Date.now(),
): EmotionalPattern {
  const recentUserMsgs = selectRecentUserMessages(messages, now);

  // Pas assez de messages pour un trend fiable — on reste stable, pas de check-in.
  if (recentUserMsgs.length < MIN_MESSAGES_FOR_TREND) {
    return {
      trend: "stable",
      signals: ["insufficient_data"],
      recommendation:
        "Pas assez de messages récents pour détecter un pattern émotionnel. Pas de check-in proactif.",
      shouldCheckIn: false,
    };
  }

  // === Scoring par message ===
  const scores = recentUserMsgs.map((m) => ({
    ts: m.ts,
    darkness: messageDarkness(m),
    darkMarkers: countMarkers(m.content, DARK_LANGUAGE_MARKERS),
    isolationMarkers: countMarkers(m.content, ISOLATION_MARKERS),
    anxietyMarkers: countMarkers(m.content, ANXIETY_ESCALATION_MARKERS),
    emotion: (m.emotion ?? analyzeEmotion(m.content).emotion) as Emotion,
  }));

  // === Trend : comparer early half vs recent half ===
  const midpoint = Math.floor(scores.length / 2);
  const earlyHalf = scores.slice(0, midpoint);
  const recentHalf = scores.slice(midpoint);
  // Si on a un seul message dans earlyHalf (cas length=3), on tolère (avg d'1 élément).
  const earlyAvg = avg(earlyHalf.map((s) => s.darkness));
  const recentAvg = avg(recentHalf.map((s) => s.darkness));
  const delta = recentAvg - earlyAvg;

  // Seuils empiriques (sur échelle 0-1) :
  //  - delta < -0.10 → improving (le recent est nettement moins sombre)
  //  - delta > +0.15 → declining (le recent est nettement plus sombre)
  //  - sinon → stable
  let trend: EmotionalTrend = "stable";
  if (delta < -0.1) trend = "improving";
  else if (delta > 0.15) trend = "declining";

  // === Signaux ===
  const signals: string[] = [];

  if (trend === "declining") {
    signals.push("declining_mood_7d");
  }

  // Increasingly dark language : si la moitié récente contient plus de markers sombres
  // que la moitié ancienne, c'est un signal de "langage qui s'assombrit".
  const earlyDarkMarkers = earlyHalf.reduce((s, x) => s + x.darkMarkers, 0);
  const recentDarkMarkers = recentHalf.reduce((s, x) => s + x.darkMarkers, 0);
  if (recentDarkMarkers > earlyDarkMarkers && recentDarkMarkers >= 2) {
    signals.push("increasing_dark_language");
    // Si le langage s'assombrit significativement, on force au moins "declining".
    if (trend === "stable") trend = "declining";
  }

  // Isolement : peu de messages sur 7 jours + markers d'isolement présents
  // OU markers d'isolement dans ≥2 messages récents.
  const isolationMsgs = scores.filter((s) => s.isolationMarkers >= 1);
  if (recentUserMsgs.length <= 4 && isolationMsgs.length >= 1) {
    signals.push("isolation");
  } else if (isolationMsgs.length >= 2) {
    signals.push("isolation");
  }

  // Escalating anxiety : markers d'anxiété présents dans ≥2 messages récents
  // ET moyenne d'anxiété supérieure dans la moitié récente vs ancienne.
  const recentAnxiety = recentHalf.filter((s) => s.anxietyMarkers >= 1).length;
  const earlyAnxiety = earlyHalf.filter((s) => s.anxietyMarkers >= 1).length;
  if (recentAnxiety >= 2 && recentAnxiety > earlyAnxiety) {
    signals.push("escalating_anxiety");
    // L'anxiété qui monte force aussi au moins "declining".
    if (trend === "stable") trend = "declining";
  }

  // === Critical : détresse répétée OU darkness récent très élevé ===
  // - ≥2 messages avec émotion "détresse" dans la fenêtre, OU
  // - darkness moyenne récente ≥ 0.6 (très sombre), OU
  // - ≥3 messages avec darkness ≥ 0.5
  const distressCount = scores.filter((s) => s.emotion === "détresse").length;
  const highDarknessRecent = recentAvg >= 0.6;
  const manyDarkMessages = scores.filter((s) => s.darkness >= 0.5).length >= 3;
  if (distressCount >= 2 || highDarknessRecent || manyDarkMessages) {
    trend = "critical";
    signals.push("critical_pattern");
  }

  // === shouldCheckIn ===
  // - improving/stable → jamais (laisser respirer l'utilisateur).
  // - declining → check-in si au moins 1 signal confirmant (pas juste delta faible).
  // - critical → toujours check-in (message doux, jamais alarmant).
  let shouldCheckIn = false;
  if (trend === "critical") {
    shouldCheckIn = true;
  } else if (trend === "declining" && signals.length >= 1) {
    shouldCheckIn = true;
  }

  // === Recommendation (humaine, pour logs/analytics — pas affichée brute) ===
  let recommendation: string;
  if (trend === "improving") {
    recommendation =
      "Humeur en amélioration sur 7 jours. Aucun check-in proactif nécessaire — laisser l'espace.";
  } else if (trend === "stable") {
    recommendation =
      "Humeur stable sur 7 jours. Aucun signal préoccupant. Pas de check-in proactif.";
  } else if (trend === "declining") {
    recommendation =
      "Humeur en baisse détectée (" +
      signals.join(", ") +
      "). Check-in doux recommandé — message d'empathie non-urgent.";
  } else {
    // critical
    recommendation =
      "Pattern émotionnel critique (" +
      signals.join(", ") +
      "). Check-in doux URGENT (sans déclencher de red flag médical — message 'tu comptes').";
  }

  // === Suggested message ===
  const suggestedMessage = shouldCheckIn
    ? pickProactiveMessage(trend, signals, recentUserMsgs.length)
    : undefined;

  return {
    trend,
    signals,
    recommendation,
    shouldCheckIn,
    suggestedMessage,
  };
}

/**
 * Wrapper léger pour le scoring d'un seul message — exposé pour /api/sentinel/status
 * qui veut renvoyer le "current emotional state" du dernier message user.
 */
export function scoreLastMessage(msg: SentinelMessage): {
  emotion: Emotion;
  darkness: number;
} {
  const emotion: Emotion = msg.emotion ?? analyzeEmotion(msg.content).emotion;
  return {
    emotion,
    darkness: messageDarkness(msg),
  };
}
