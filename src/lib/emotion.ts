/**
 * Sankofa — Détection émotionnelle (V1)
 *
 * Analyse le sentiment du message utilisateur pour adapter la réponse.
 * Léger : règles + keywords (pas de LLM supplémentaire — privacy + perf).
 *
 * Émotions détectées :
 *  - "détresse"     : idées sombres, douleur morale intense → check-in émotionnel
 *  - "anxieux"      : peur, angoisse, stress, inquiétude
 *  - "triste"       : découragement, solitude, deuil
 *  - "colère"       : frustration, rage, agressivité
 *  - "honte"        : culpabilité, gêne, peur du jugement
 *  - "neutre"       : question factuelle, pas d'émotion marquée
 *
 * Privacy-safe : analyse locale, aucune donnée envoyée à un service tiers.
 */

export type Emotion =
  | "détresse"
  | "anxieux"
  | "triste"
  | "colère"
  | "honte"
  | "neutre";

export interface EmotionAnalysis {
  emotion: Emotion;
  /** Score de confiance 0-1 (1 = émotion très marquée). */
  intensity: number;
  /** True si l'émotion nécessite un check-in émotionnel (détresse haute). */
  needsCheckIn: boolean;
}

const EMOTION_MARKERS: Record<Exclude<Emotion, "neutre">, string[]> = {
  détresse: [
    "je veux mourir", "envie de mourir", "suicid", "en finir", "plus rien a perdre",
    "je suis perd", "desespoir", "abandon", "je ne sers a rien", "plus la force",
    "je voudrais disparaitre", "mieux vaut mourir", "je me deteste", "je hais ma vie",
  ],
  anxieux: [
    "angoisse", "angoisse", "anxieu", "peur", "stress", "panique", "inquiet",
    "stressant", "stressante", "anxiété", "angoissé", "angoisse",
    "j ai peur", "j'ai peur", "ca m angoisse", "ca m'angoisse", "jangoisse",
    "tremblement", "palpitation", "boule au ventre", "suffoqu",
  ],
  triste: [
    "triste", "deprim", "depressif", "depressive", "malheureux", "malheureuse",
    "seul au monde", "isole", "isolee", "abandonne", "abandonnee",
    "pleure", "pleurer", "larmes", "vide", "je me sens mal", "le moral a zero",
    "decourage", "decouragee", "decouragement", "sans espoir",
  ],
  colère: [
    "enerve", "enerve", "fou", "folle", "rage", "colere", "colère",
    "je deteste", "je hais", "ca m'enerve", "ca m enerve", "agace", "agace",
    "frustre", "frustree", "frustration", "je vais exploser", "marre",
  ],
  honte: [
    "honte", "genant", "genante", "gené", "gêné", "gene", "gêné",
    "j ai honte", "j'ai honte", "culpable", "coupable", "j ose pas", "j'ose pas",
    "peur du jugement", "peur qu on se moque", "peur qu'on se moque",
    "je n ai pas ose", "je n'ai pas osé", "timide",
  ],
};

/**
 * Analyse l'émotion dominante du message.
 * Si plusieurs émotions matchent, on prend celle avec le plus de marqueurs
 * (priorité à la détresse si présente, pour la sécurité).
 */
export function analyzeEmotion(message: string): EmotionAnalysis {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return { emotion: "neutre", intensity: 0, needsCheckIn: false };
  }

  const scores: Record<Exclude<Emotion, "neutre">, number> = {
    détresse: 0,
    anxieux: 0,
    triste: 0,
    colère: 0,
    honte: 0,
  };

  for (const [emotion, markers] of Object.entries(EMOTION_MARKERS) as Array<
    [Exclude<Emotion, "neutre">, string[]]
  >) {
    for (const marker of markers) {
      if (normalized.includes(marker)) {
        scores[emotion]++;
      }
    }
  }

  // Priorité à la détresse (sécurité)
  if (scores.détresse > 0) {
    return {
      emotion: "détresse",
      intensity: Math.min(1, 0.6 + scores.détresse * 0.2),
      needsCheckIn: true,
    };
  }

  // Trouver l'émotion dominante (score max)
  let dominantEmotion: Exclude<Emotion, "neutre"> | null = null;
  let maxScore = 0;
  for (const [emotion, score] of Object.entries(scores) as Array<
    [Exclude<Emotion, "neutre">, number]
  >) {
    if (score > maxScore) {
      maxScore = score;
      dominantEmotion = emotion;
    }
  }

  if (!dominantEmotion || maxScore === 0) {
    return { emotion: "neutre", intensity: 0, needsCheckIn: false };
  }

  const intensity = Math.min(1, 0.3 + maxScore * 0.25);
  // Check-in si émotion forte (intensité ≥ 0.55) ou si triste/anxieux avec intensité élevée
  const needsCheckIn =
    intensity >= 0.55 &&
    (dominantEmotion === "triste" || dominantEmotion === "anxieux" || dominantEmotion === "colère");

  return {
    emotion: dominantEmotion,
    intensity,
    needsCheckIn,
  };
}

/**
 * Génère un préfixe d'empathie selon l'émotion détectée.
 * Préfixé à la réponse LLM pour ack l'émotion avant l'info.
 */
export function getEmpathyPrefix(emotion: Emotion, intensity: number): string {
  if (emotion === "neutre" || intensity < 0.3) return "";
  const prefixes: Record<Exclude<Emotion, "neutre">, string[]> = {
    détresse: [
      "Je t'entends, et ce que tu ressens est valide. Tu n'es pas seul·e. 🤍\n\n",
    ],
    anxieux: [
      "Je sens que tu es angoissé·e, et c'est normal de l'être. Respire un coup. 🌿\n\n",
      "Je comprends ton inquiétude. On va regarder ça ensemble. 🌿\n\n",
    ],
    triste: [
      "Je sens que tu vas mal, et je suis là. Tu n'es pas seul·e avec ça. 🤍\n\n",
      "Je t'entends. C'est déjà immense d'en parler. 🤍\n\n",
    ],
    colère: [
      "Je sens ta frustration, et tu as le droit de l'exprimer ici. 🌿\n\n",
    ],
    honte: [
      "Je sens que c'est difficile à dire, et tu fais bien de parler. Ici, zéro jugement. 🤍\n\n",
      "Tu n'as pas à avoir honte. On est ensemble. 🌿\n\n",
    ],
  };
  const arr = prefixes[emotion];
  return arr[Math.floor(Math.random() * arr.length)] ?? "";
}
