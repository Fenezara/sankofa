/**
 * Sankofa — Recommandation de persona selon le contexte (V1)
 *
 * Heuristique simple : analyse le message et recommande le persona
 * le plus adapté. L'utilisateur garde le choix final (pas d'auto-switch).
 *
 * Règles :
 *  - Tonton Koffi (médecin) : questions techniques, termes médicaux, dosage, pharmacologie
 *  - Yao (grand frère) : addictologie, questions masculines, rapports, tabac, alcool
 *  - Aya (grande sœur) : sujets intimes, cycles, contraception, violences, défaut
 */

import type { Persona } from "./guardrails";

export interface PersonaRecommendation {
  /** Persona recommandé pour ce message. */
  recommended: Persona;
  /** Persona actuellement actif. */
  current: Persona;
  /** True si une recommandation de switch est pertinente (différent de current). */
  shouldSuggest: boolean;
  /** Raison courte affichée à l'utilisateur. */
  reason: string;
}

const TECHNICAL_MEDICAL_KEYWORDS = [
  "dosage", "posologie", "contre indication", "contre-indication", "interaction",
  "molecule", "molécule", "principe actif", "pharmacolog", "effet secondaire",
  "antibiotique", "amoxicilline", "azithromycine", "ciprofloxacine",
  "ist", "mst", "gonococcie", "chlamydiose", "syphilis", "vih", "hpv",
  "tpa", "tpv", "tpha", "vdrl", "serologie", "pcr",
  "cycle menstruel", "ovulation", "endometre", "uterus", "col uterin",
  "dermatite", "eczema", "psoriasis", "melanome",
];

const BIG_BROTHER_KEYWORDS = [
  "tramadol", "codeine", "codéine", "alcool", "tabac", "cigarette", "cannabis",
  "weed", "shit", "joint", "addiction", "accro", "sevrage", "drogue",
  "copain", "mec", "frangin", "potes", "mes potes", "on a bu",
  "preservatif craque", "capote", "premiere fois", "première fois",
  "ejaculation", "erection", "performance",
];

const BIG_SISTER_KEYWORDS = [
  "regles", "règles", "cycle", "pilule", "oubli pilule", "contraception",
  "grossesse", "test grossesse", "ivg", "avortement",
  "vagin", "vaginal", "pertes", "ecoulement",
  "viol", "agression", "harcelement", "harcèlement",
  "copine", "mon copain me", "il m a forcé", "il m'a forcé",
  "sein", "seins", "poitrine", "endometriose",
];

function countMatches(normalized: string, keywords: string[]): number {
  let count = 0;
  for (const kw of keywords) {
    if (normalized.includes(kw)) count++;
  }
  return count;
}

/**
 * Recommande un persona basé sur le contenu du message.
 */
export function recommendPersona(
  message: string,
  currentPersona: Persona,
): PersonaRecommendation {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const technicalScore = countMatches(normalized, TECHNICAL_MEDICAL_KEYWORDS);
  const bigBrotherScore = countMatches(normalized, BIG_BROTHER_KEYWORDS);
  const bigSisterScore = countMatches(normalized, BIG_SISTER_KEYWORDS);

  // Trouve le score max
  const max = Math.max(technicalScore, bigBrotherScore, bigSisterScore);

  // Si aucun match clair, on garde le persona actuel
  if (max === 0) {
    return {
      recommended: currentPersona,
      current: currentPersona,
      shouldSuggest: false,
      reason: "",
    };
  }

  let recommended: Persona;
  let reason: string;

  if (technicalScore === max) {
    recommended = "tonton_medecin";
    reason = "Question médicale technique — Tonton Koffi pourrait t'expliquer plus en détail.";
  } else if (bigBrotherScore === max) {
    recommended = "grand_frere";
    reason = "Sujet addictologie / masculin — Yao, le grand frère, connaît bien ça.";
  } else {
    recommended = "grande_soeur";
    reason = "Sujet intime / SSR — Aya, la grande sœur, est là pour ça.";
  }

  return {
    recommended,
    current: currentPersona,
    shouldSuggest: recommended !== currentPersona,
    reason,
  };
}
