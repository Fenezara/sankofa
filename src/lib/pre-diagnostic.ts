/**
 * Sankofa — Pré-diagnostic enrichi (V4)
 *
 * Module de pré-diagnostic structuré pour guider Sankofa dans l'évaluation
 * éducative des symptômes décrits par l'utilisateur. Ce n'est PAS un diagnostic
 * médical — c'est un triage éducatif qui aide à :
 *  1. Catégoriser la sévérité (info / orientation / urgence)
 *  2. Identifier les causes éducatives possibles (pas un diagnostic)
 *  3. Évaluer les facteurs de risque contextuels
 *  4. Détecter les signes d'alerte (red flags secondaires)
 *  5. Proposer des conseils de prévention non médicaux
 *
 * CONFORMITÉ : Aucun diagnostic formel, aucune prescription, disclaimer systématique.
 */

export type PreDiagnosticSeverity = "info" | "orientation" | "urgence";

export interface SymptomPattern {
  id: string;
  domain: "SSR" | "Addictologie" | "Dermatologie" | "Santé mentale" | "Nutrition" | "Puberté" | "Vaccination" | "Général";
  /** Mots-clés qui déclenchent ce pattern (normalisés, sans accents) */
  keywords: string[];
  /** Sévérité éducative (pas un diagnostic) */
  severity: PreDiagnosticSeverity;
  /** Causes éducatives possibles (PAS un diagnostic) */
  possibleCauses: string[];
  /** Conséquences si ignoré */
  consequencesIfIgnored: string[];
  /** Facteurs de risque contextuels */
  riskFactors: string[];
  /** Signes d'alerte qui nécessitent consultation rapide */
  redFlagSigns: string[];
  /** Conseils de prévention non médicaux */
  prevention: string[];
  /** Questions de triage à poser (pour approfondir) */
  triageQuestions: string[];
  /** Orientation locale recommandée */
  orientation: string;
}

/**
 * Catalogue de patterns symptomatiques éducatifs.
 * Chaque pattern aide Sankofa à structurer sa réponse sans diagnostic.
 */
export const SYMPTOM_PATTERNS: SymptomPattern[] = [
  // === SSR ===
  {
    id: "burning_urination",
    domain: "SSR",
    keywords: ["brulure", "uriner", "pipi", "dysurie", "brule"],
    severity: "orientation",
    possibleCauses: [
      "IST (chlamydiose, gonococcie, trichomonase)",
      "Infection urinaire (cystite)",
      "Irritation (savon, produits, rapports)",
    ],
    consequencesIfIgnored: [
      "IST non traitée → stérilité (surtout filles)",
      "Infection qui remonte (pyélonéphrite)",
      "Transmission au/à la partenaire",
    ],
    riskFactors: [
      "Rapports non protégés",
      "Multiples partenaires",
      "Mauvaise hygiène intime",
    ],
    redFlagSigns: [
      "Fièvre + frissons",
      "Douleur pelvienne forte",
      "Écoulement purulent (jaune-vert)",
      "Sang dans les urines",
    ],
    prevention: [
      "Préservatif à chaque rapport",
      "Boire beaucoup d'eau",
      "Hygiène intime douce (pas de savon agressif)",
      "Uriner après les rapports",
    ],
    triageQuestions: [
      "Depuis combien de temps ?",
      "Tu as d'autres symptômes (fièvre, pertes, douleurs) ?",
      "Tu as eu des rapports récemment ? Protégés ?",
    ],
    orientation: "AIBEF Abidjan (27 22 44 09 09) — dépistage gratuit pour les jeunes",
  },
  {
    id: "unprotected_sex",
    domain: "SSR",
    keywords: ["rapport non protege", "preservatif craque", "capote craque", "sans protection"],
    severity: "orientation",
    possibleCauses: [
      "Risque d'IST (VIH, chlamydiose, gonococcie, syphilis, hépatite B)",
      "Risque de grossesse non désirée",
    ],
    consequencesIfIgnored: [
      "IST asymptomatique pendant des mois/années",
      "Grossesse non prévue",
      "Transmission au/à la partenaire",
    ],
    riskFactors: [
      "Rapport avec partenaire inconnu·e",
      "Multiples partenaires",
      "Pas de dépistage régulier",
    ],
    redFlagSigns: [
      "Si < 72h → TPE possible (urgence relative)",
      "Si symptômes apparaissent (brûlure, pertes, fièvre)",
    ],
    prevention: [
      "Préservatif à chaque rapport",
      "Dépistage régulier (tous les 6-12 mois si actif·ve)",
      "Vaccination HPV (filles 9-14 ans, gratuit)",
      "Vaccination hépatite B",
    ],
    triageQuestions: [
      "Quand a eu lieu le rapport ? (pour fenêtre TPE 72h)",
      "Tu connais le/la partenaire ?",
      "Tu as déjà fait un dépistage ?",
    ],
    orientation: "Si < 72h : CHU Cocody/Treichville (TPE). Sinon : AIBEF (dépistage gratuit)",
  },
  {
    id: "missed_period",
    domain: "SSR",
    keywords: ["regles en retard", "retard de regles", "pas mes regles", "amennorhee"],
    severity: "orientation",
    possibleCauses: [
      "Grossesse (si rapports sexuels)",
      "Stress / choc émotionnel",
      "Variation hormonale (puberté, allaitement)",
      "Perte de poids rapide / anorexie",
      "Contrôle des naissances (pilule, implant)",
    ],
    consequencesIfIgnored: [
      "Grossesse non détectée → retard de prise en charge",
      "Cause sous-jacente non traitée",
    ],
    riskFactors: [
      "Rapports non protégés",
      "Stress intense (examens, famille)",
      "Changement de poids important",
    ],
    redFlagSigns: [
      "Retard > 2 semaines + douleurs abdominales (grossesse extra-utérine ?)",
      "Saignements abondants après retard",
      "Fièvre + douleurs pelviennes",
    ],
    prevention: [
      "Test de grossesse si retard > 5 jours (pharmacie ~500-1500 F)",
      "Contrôle régulier si sexually active",
      "Gestion du stress (sommeil, exercice)",
    ],
    triageQuestions: [
      "Depuis combien de temps tes règles sont en retard ?",
      "Tu as eu des rapports récemment ? Protégés ?",
      "Tu es stressé·e en ce moment ?",
    ],
    orientation: "Test grossesse pharmacie. Si positif : AIBEF (conseil, options légales CI)",
  },
  // === DERMATOLOGIE ===
  {
    id: "acne",
    domain: "Dermatologie",
    keywords: ["acne", "boutons", "pimples", "visage"],
    severity: "info",
    possibleCauses: [
      "Hormones (puberté, cycles, stress)",
      "Production de sébum excessive",
      "Pores obstrués (mort cells + sébum)",
      "Bactérie P. acnes",
    ],
    consequencesIfIgnored: [
      "Cicatrices permanentes (si on perce)",
      "Hyperpigmentation post-acnéique",
      "Impact psychologique (estime de soi)",
    ],
    riskFactors: [
      "Stress (examens, famille)",
      "Manque de sommeil",
      "Alimentation riche en sucre",
      "Produits cosmétiques comédogènes",
    ],
    redFlagSigns: [
      "Boutons très douloureux / kystiques",
      "Acne qui couvre tout le visage",
      "Cicatrices profondes",
      "Acne + fièvre (infection)",
    ],
    prevention: [
      "Lavage 2x/jour avec savon doux",
      "Pas percer les boutons (cicatrices)",
      "Éviter produits gras sur le visage",
      "Boire beaucoup d'eau",
      "Sommeil 7-8h",
    ],
    triageQuestions: [
      "Depuis combien de temps tu as de l'acné ?",
      "C'est sur tout le visage ou certaines zones ?",
      "Tu utilises des produits sur ton visage ?",
    ],
    orientation: "Dermatologue CHU Cocody (si sévère) ou médecin généraliste",
  },
  {
    id: "skin_lightening",
    domain: "Dermatologie",
    keywords: ["eclaircissant", "depigmentation", "blanchir", "hydroquinone", "creme claire"],
    severity: "orientation",
    possibleCauses: [
      "Pression sociale / colorisme",
      "Manque d'information sur les dangers",
      "Produits en vente libre (illégaux mais disponibles)",
    ],
    consequencesIfIgnored: [
      "Cancer de la peau (hydroquinone)",
      "Ochronose (taches noires irréversibles)",
      "Amincissement de la peau (corticoïdes)",
      "Infections récurrentes (immunité affaiblie)",
      "Vieillissement prématuré",
    ],
    riskFactors: [
      "Pression familiale/sociale",
      "Manque d'information",
      "Produits non réglementés",
    ],
    redFlagSigns: [
      "Taches noires sur la peau",
      "Peau qui se décolle",
      "Infections à répétition",
      "Vergetures étendues",
    ],
    prevention: [
      "Loi CI 2015 : interdiction produits éclaircissants",
      "Accepter sa couleur de peau",
      "Soins hydratants naturels (beurre de karité)",
      "Protection solaire (chapeau, crème solaire)",
    ],
    triageQuestions: [
      "Tu utilises des produits éclaircissants en ce moment ?",
      "Depuis combien de temps ?",
      "Tu as remarqué des changements sur ta peau ?",
    ],
    orientation: "Dermatologue CHU (si lésions). AIBEF pour info/soutien",
  },
  // === ADDICTOLOGIE ===
  {
    id: "tramadol_use",
    domain: "Addictologie",
    keywords: ["tramadol", "tramal", "bonbon", "dependance", "accro"],
    severity: "orientation",
    possibleCauses: [
      "Dépendance physique (opioïde)",
      "Usage récréatif / pour 'tenir'",
      "Automédication pour douleur/stress",
    ],
    consequencesIfIgnored: [
      "Dépendance sévère (sevrage dangereux)",
      "Problèmes hépatiques / rénaux",
      "Risque de surdose",
      "Troubles neurologiques",
      "Isolement social",
    ],
    riskFactors: [
      "Usage quotidien",
      "Dosage croissant",
      "Association avec alcool / autres substances",
      "Stress / pression (travail, examens)",
    ],
    redFlagSigns: [
      "Tremblements / hallucinations au sevrage",
      "Malaise après prise",
      "Idées noires",
      "Perte de conscience",
    ],
    prevention: [
      "Ne jamais arrêter brutalement (sevrage dangereux)",
      "Parler à un·e professionnel·le",
      "Trouver des alternatives saines (sport, soutien)",
    ],
    triageQuestions: [
      "Depuis combien de temps tu en prends ?",
      "Combien par jour ?",
      "Tu as essayé d'arrêter ? Comment ça s'est passé ?",
    ],
    orientation: "143 (écoute) + CHU Cocody addictologie (sevrage encadré)",
  },
  // === SANTÉ MENTALE ===
  {
    id: "depression_signs",
    domain: "Santé mentale",
    keywords: ["triste", "deprime", "depress", "malheureux", "vide", "desesperer"],
    severity: "orientation",
    possibleCauses: [
      "Épisode dépressif (trouble médical)",
      "Stress chronique (examens, famille)",
      "Deuil / rupture / perte",
      "Harcèlement scolaire / cyberharcèlement",
      "Isolement social",
    ],
    consequencesIfIgnored: [
      "Aggravation (idées suicidaires)",
      "Échec scolaire / professionnel",
      "Isolement profond",
      "Automédication (addictions)",
    ],
    riskFactors: [
      "Antécédents familiaux",
      "Stress accumulé (BEPC/BAC, famille, argent)",
      "Manque de soutien social",
      "Tabou santé mentale ('sois fort')",
    ],
    redFlagSigns: [
      "Idées suicidaires → URGENCE 143/185",
      "Perte d'intérêt totale (anhédonie)",
      "Troubles du sommeil +2 semaines",
      "Perte/gain de poids significatif",
      "Cries de détresse",
    ],
    prevention: [
      "Parler à quelqu'un de confiance",
      "Activité physique régulière",
      "Sommeil 7-8h",
      "Éviter isolement (amis, famille, soutien)",
    ],
    triageQuestions: [
      "Depuis combien de temps tu te sens comme ça ?",
      "Ça affecte ton sommeil, ton appétit ?",
      "Tu as des pensées noires ? (si oui → red flag suicide)",
      "Tu as quelqu'un à qui parler ?",
    ],
    orientation: "143 (numéro vert gratuit 24/7). CHU Cocody psychiatrie (si sévère)",
  },
  {
    id: "anxiety",
    domain: "Santé mentale",
    keywords: ["angoisse", "anxieux", "stress", "panique", "peur", "angoisse"],
    severity: "info",
    possibleCauses: [
      "Anxiété situationnelle (examens, famille)",
      "Trouble anxieux généralisé (TAG)",
      "Crises d'angoisse / panique",
      "Stress chronique",
    ],
    consequencesIfIgnored: [
      "Épuisement physique/mental",
      "Troubles du sommeil",
      "Évitement (phobies)",
      "Impact scolaire/professionnel",
    ],
    riskFactors: [
      "Pression (examens, famille, argent)",
      "Manque de sommeil",
      "Caféine / substances",
      "Isolement",
    ],
    redFlagSigns: [
      "Crises de panique fréquentes",
      "Évitement total (ne plus sortir)",
      "Idées noires",
      "Symptômes physiques (palpitations, suffocation)",
    ],
    prevention: [
      "Respiration profonde (4-7-8 : inspire 4s, bloque 7s, expire 8s)",
      "Ancrage 5-4-3-2-1 (5 choses que tu vois, 4 que tu touches, etc.)",
      "Activité physique régulière",
      "Sommeil régulier",
      "Réduire caféine",
    ],
    triageQuestions: [
      "C'est plutôt une angoisse constante ou des crises ?",
      "Ça arrive dans des situations précises ou tout le temps ?",
      "Tu arrives à dormir ?",
    ],
    orientation: "143 si détresse. Psychologue (cabinet privé) si chronique",
  },
  // === NUTRITION ===
  {
    id: "fatigue_chronic",
    domain: "Nutrition",
    keywords: ["fatigue", "epuise", "pas energie", "faible", "etourdi"],
    severity: "info",
    possibleCauses: [
      "Manque de sommeil (<7h)",
      "Carence en fer (anémie — fréquente chez filles)",
      "Mauvaise alimentation (sucre, manque de protéines)",
      "Déshydratation (pas assez d'eau)",
      "Stress / dépression",
      "Paludisme (si fièvre)",
    ],
    consequencesIfIgnored: [
      "Baisse des résultats scolaires",
      "Système immunitaire affaibli",
      "Aggravation d'une cause sous-jacente",
    ],
    riskFactors: [
      "Sommeil irrégulier",
      "Alimentation déséquilibrée",
      "Stress chronique",
      "Règles abondantes (filles)",
    ],
    redFlagSigns: [
      "Fatigue + fièvre (paludisme ?)",
      "Perte de poids involontaire",
      "Pâleur extrême (anémie sévère)",
      "Vertiges / évanouissements",
    ],
    prevention: [
      "Sommeil 7-8h régulier",
      "Boire 1.5L d'eau/jour",
      "Fer (viande rouge, épinards, arachides)",
      "Petit-déjeuner équilibré",
      "Activité physique modérée",
    ],
    triageQuestions: [
      "Tu dors combien d'heures par nuit ?",
      "Tu manges comment en ce moment ?",
      "Tu as d'autres symptômes (fièvre, pâleur) ?",
    ],
    orientation: "Centre de santé (si fièvre/pâleur). Sinon : équilibre alimentaire",
  },
  // === GÉNÉRAL ===
  {
    id: "fever",
    domain: "Général",
    keywords: ["fievre", "chaud", "temperature", "frissons"],
    severity: "orientation",
    possibleCauses: [
      "Paludisme (très fréquent en CI, saison des pluies)",
      "Infection virale (grippe, dengue)",
      "Infection bactérienne",
      "IST (parfois)",
    ],
    consequencesIfIgnored: [
      "Paludisme sévère (neuro-paludisme, mortel)",
      "Déshydratation",
      "Complications selon la cause",
    ],
    riskFactors: [
      "Saison des pluies (paludisme)",
      "Pas de moustiquaire",
      "Zone à risque",
    ],
    redFlagSigns: [
      "Fièvre > 39°C",
      "Convulsions",
      "Confusion / somnolence",
      "Vomissements persistants",
      "Difficultés respiratoires",
    ],
    prevention: [
      "Moustiquaire imprégnée",
      "Tester au paludisme si fièvre (TDR)",
      "Hydratation",
      "Consulter rapidement",
    ],
    triageQuestions: [
      "Quelle est ta température ?",
      "Depuis combien de jours ?",
      "Tu as d'autres symptômes (maux de tête, vomissements) ?",
    ],
    orientation: "Centre de santé (test paludisme). 185 SAMU si urgence",
  },
];

/**
 * Identifie le pattern symptomatique le plus pertinent pour un message.
 */
export function identifySymptomPattern(message: string): SymptomPattern | null {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  let bestMatch: SymptomPattern | null = null;
  let bestScore = 0;

  for (const pattern of SYMPTOM_PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.length > 4 ? 2 : 1; // keywords longs = plus pertinents
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

/**
 * Génère une réponse pré-diagnostic structurée à partir d'un pattern.
 * Retourne un objet que Sankofa peut utiliser pour construire sa réponse.
 */
export function buildPreDiagnosticResponse(
  pattern: SymptomPattern,
  options?: { includeOrientation?: boolean },
): {
  triageQuestions: string[];
  causes: string[];
  consequences: string[];
  riskFactors: string[];
  redFlagSigns: string[];
  prevention: string[];
  orientation: string | null;
  disclaimer: string;
} {
  return {
    triageQuestions: pattern.triageQuestions,
    causes: pattern.possibleCauses,
    consequences: pattern.consequencesIfIgnored,
    riskFactors: pattern.riskFactors,
    redFlagSigns: pattern.redFlagSigns,
    prevention: pattern.prevention,
    orientation: options?.includeOrientation ? pattern.orientation : null,
    disclaimer:
      "Ce sont des pistes éducatives, pas un diagnostic — seul un médecin peut confirmer.",
  };
}

/**
 * Évalue la sévérité globale d'une situation à partir des signes d'alerte.
 */
export function evaluateSeverity(
  message: string,
  pattern: SymptomPattern | null,
): PreDiagnosticSeverity {
  if (pattern?.severity === "urgence") return "urgence";

  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Signes d'alerte qui passent en urgence
  const urgencySigns = [
    "suicide", "mourir", "tuer", "envie de mourir",
    "saignement abondant", "perte de conscience", "convulsion",
    "difficulte respiratoire", "etouffe", "overdose",
    "viol", "agression",
  ];

  if (urgencySigns.some((s) => normalized.includes(s))) return "urgence";

  // Signes d'orientation (consultation recommandée)
  const orientationSigns = [
    "douleur forte", "fievre haute", "malaise", "vertige",
    "vomi", "nausee", "perte de poids",
  ];

  if (orientationSigns.some((s) => normalized.includes(s))) return "orientation";

  return pattern?.severity ?? "info";
}
