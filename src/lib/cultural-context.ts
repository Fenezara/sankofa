/**
 * Sankofa — Compétences culturelles, religieuses & traditionnelles (V4.1)
 *
 * Enrichit Sankofa avec les réalités culturelles, religieuses et traditionnelles
 * ivoiriennes pour qu'elle soit profondément ancrée dans son contexte.
 *
 * CONFORMITÉ :
 *  - Pas de prescription de plantes médicinales (info éducative seulement)
 *  - Pas de conseil religieux (respect sans prêche)
 *  - Pas de validation de pratiques non encadrées
 *  - Orientation systématique vers la médecine moderne pour le diagnostic
 */

// ============================================================
// 1. LANGUES LOCALES & EXPRESSIONS COURANTES
// ============================================================

export interface LocalExpression {
  expression: string;
  language: "Nouchi" | "Dioula" | "Baoulé" | "FR-CI";
  meaning: string;
  context: string; // quand l'utiliser
  sankofaReply?: string; // réponse suggérée pour Sankofa
}

export const LOCAL_EXPRESSIONS: LocalExpression[] = [
  // Nouchi
  { expression: "yako", language: "Nouchi", meaning: "ça va / ok", context: "Acquiescement", sankofaReply: "Yako, je comprends." },
  { expression: "drap", language: "Nouchi", meaning: "pas de problème", context: "Rassurer", sankofaReply: "Y'a pas drap, on est ensemble." },
  { expression: "poto", language: "Nouchi", meaning: "ami·e", context: "Tutoiement fraternel", sankofaReply: "Salut poto 👋" },
  { expression: "enjailler", language: "Nouchi", meaning: "s'amuser / kiffer", context: "Positive", sankofaReply: "On va enjailler ça ensemble." },
  { expression: "were", language: "Nouchi", meaning: "vite / rapide", context: "Urgence", sankofaReply: "On va were ça." },

  // Dioula
  { expression: "i ni ce", language: "Dioula", meaning: "bonjour", context: "Salutation matinale", sankofaReply: "I ni ce. Comment ça va ?" },
  { expression: "aw ni baara", language: "Dioula", meaning: "bonjour (pluriel)", context: "Salutation groupe", sankofaReply: "Aw ni baara." },
  { expression: "i ka kɛnɛ", language: "Dioula", meaning: "comment ça va ?", context: "Politesse", sankofaReply: "I ka kɛnɛ ?" },
  { expression: "jɔ ka nyɛ", language: "Dioula", meaning: "ça va bien", context: "Réponse positive", sankofaReply: "Jɔ ka nyɛ, merci." },

  // Baoulé
  { expression: "kpatou", language: "Baoulé", meaning: "bonjour (matin)", context: "Salutation Akan", sankofaReply: "Kpatou. E yace ?" },
  { expression: "e yace", language: "Baoulé", meaning: "comment ça va ?", context: "Politesse", sankofaReply: "E yace ?" },
  { expression: "m'afiɛ", language: "Baoulé", meaning: "merci", context: "Gratitude", sankofaReply: "M'afiɛ beaucoup." },

  // FR-CI (français ivoirien)
  { expression: "ça va", language: "FR-CI", meaning: "comment ça va", context: "Standard", sankofaReply: "Ça va, et toi ?" },
  { expression: "on est ensemble", language: "FR-CI", meaning: "solidarité", context: "Soutien", sankofaReply: "On est ensemble. 🌿" },
];

/**
 * Détecte une expression locale dans un message.
 * Retourne la première expression trouvée.
 */
export function detectLocalExpression(message: string): LocalExpression | null {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .trim();

  for (const expr of LOCAL_EXPRESSIONS) {
    const exprNormalized = expr.expression
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(exprNormalized)) {
      return expr;
    }
  }
  return null;
}

// ============================================================
// 2. CALENDRIER CULTUREL & RELIGIEUX CI
// ============================================================

export interface CulturalEvent {
  id: string;
  name: string;
  type: "religieux" | "culturel" | "national" | "scolaire";
  period: string; // "variable" ou "fixe: MM-DD"
  healthContext: string; // impact sur la santé des jeunes
  sankofaAdvice: string; // conseil Sankofa adapté
}

export const CULTURAL_CALENDAR: CulturalEvent[] = [
  {
    id: "ramadan",
    name: "Ramadan",
    type: "religieux",
    period: "variable (9e mois calendrier hégirien)",
    healthContext: "Jeûne diurne → déshydratation, fatigue, variation glycémie. rupture à l'aube et au coucher.",
    sankofaAdvice: "Pendant le Ramadan, pense à bien t'hydrater entre le coucher et l'aube. Évite les repas trop lourds. Si tu te sens faible, repose-toi.",
  },
  {
    id: "tabaski",
    name: "Tabaski (Aïd el-Kébir)",
    type: "religieux",
    period: "variable (10e mois hégirien)",
    healthContext: "Fête → grande consommation de viande. Risque de troubles digestifs.",
    sankofaAdvice: "Pour Tabaski, mange la viande avec modération. Bien cuire pour éviter les parasites. Bois beaucoup d'eau.",
  },
  {
    id: "noel",
    name: "Noël",
    type: "religieux",
    period: "fixe: 12-25",
    healthContext: "Fêtes → excès alimentaires, alcool (jeunes), stress financier.",
    sankofaAdvice: "Noël, c'est la fête, mais fais attention aux excès. Hydrate-toi, mange équilibré entre les repas copieux.",
  },
  {
    id: "rentree-scolaire",
    name: "Rentrée scolaire",
    type: "scolaire",
    period: "fixe: 09-01",
    healthContext: "Stress, manque de sommeil, dépenses (fournitures, uniformes). Propagation maladies (grippe, rougeole).",
    sankofaAdvice: "Rentrée : dors au moins 7h, mange bien le matin. Si tu te sens stressé·e, c'est normal. On est ensemble.",
  },
  {
    id: "examen-bepc",
    name: "Examens BEPC / BAC",
    type: "scolaire",
    period: "variable (juin-juillet)",
    healthContext: "Stress intense, nuits blanches, automédication (tramadol pour 'tenir').",
    sankofaAdvice: "Pendant les examens, dors au moins 7h — nuit blanche = contre-productif. Pas de tramadol pour 'tenir'. Respirations profondes si stress.",
  },
  {
    id: "saison-pluies",
    name: "Saison des pluies",
    type: "culturel",
    period: "variable (mai-juillet, septembre-novembre)",
    healthContext: "Paludisme ++ (moustiques), rhumes, infections respiratoires, choléra.",
    sankofaAdvice: "Saison des pluies : dors sous moustiquaire. Si fièvre, va vite au centre de santé (test paludisme).",
  },
  {
    id: "fete-independance",
    name: "Fête de l'Indépendance",
    type: "national",
    period: "fixe: 08-07",
    healthContext: "Célébrations → alcool, accidents de la route.",
    sankofaAdvice: "Fête de l'Indépendance : fais la fête, mais ne bois pas et ne conduis pas. Désigne un capitaine de soirée.",
  },
  {
    id: "poro-senoufo",
    name: "Poro (initiation Sénoufo)",
    type: "culturel",
    period: "variable (région nord)",
    healthContext: "Rites initiatiques → risques de blessures, infections si scarifications non encadrées.",
    sankofaAdvice: "Si tu participes à un rite initiatique, assure-toi que les conditions sont hygiéniques. En cas de blessure, désinfecte et vois un médecin.",
  },
];

/**
 * Retourne l'événement culturel actuel (ou à venir) selon la date.
 */
export function getCurrentCulturalEvent(date: Date = new Date()): CulturalEvent | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const monthDay = `${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  // Events fixes
  for (const event of CULTURAL_CALENDAR) {
    if (event.period.startsWith("fixe: ")) {
      const eventDate = event.period.replace("fixe: ", "");
      if (eventDate === monthDay) return event;
    }
  }

  // Events variables — approximation par mois
  if (month >= 5 && month <= 7) {
    return CULTURAL_CALENDAR.find((e) => e.id === "saison-pluies") ?? null;
  }
  if (month >= 6 && month <= 7) {
    return CULTURAL_CALENDAR.find((e) => e.id === "examen-bepc") ?? null;
  }
  if (month === 9) {
    return CULTURAL_CALENDAR.find((e) => e.id === "rentree-scolaire") ?? null;
  }

  return null;
}

// ============================================================
// 3. PLANTES MÉDICINALES CI (info éducative, PAS de prescription)
// ============================================================

export interface MedicinalPlant {
  id: string;
  name: string;
  scientificName: string;
  localNames: string[];
  traditionalUses: string[];
  validatedBenefits: string[]; // par l'OMS ou études
  cautions: string[];
  disclaimer: string;
}

export const MEDICINAL_PLANTS: MedicinalPlant[] = [
  {
    id: "neem",
    name: "Neem (Margousier)",
    scientificName: "Azadirachta indica",
    localNames: ["neem", "nimba", "gôni"],
    traditionalUses: ["Paludisme (fièvre)", "Soins de peau (acné, eczéma)", "Antiseptique"],
    validatedBenefits: ["Propriétés antipaludiques reconnues (complément, pas substitut)", "Antibactérien léger", "Anti-inflammatoire"],
    cautions: ["Ne remplace pas le traitement antipaludique", "Interactions possibles", "Éviter pendant grossesse"],
    disclaimer: "Le neem peut aider en complément, mais ne remplace pas le traitement du paludisme. Consulte un médecin.",
  },
  {
    id: "moringa",
    name: "Moringa",
    scientificName: "Moringa oleifera",
    localNames: ["moringa", "arzân", "neverdie"],
    traditionalUses: ["Malnutrition", "Fatigue", "Allaitement (boost lait)"],
    validatedBenefits: ["Très riche en nutriments (fer, vitamines, protéines)", "Antioxydant", "Études OMS pour malnutrition"],
    cautions: ["Pas de surdosage", "Qualité variable (non réglementé)", "Éviter racines pendant grossesse"],
    disclaimer: "Le moringa est un excellent complément nutritionnel, mais vérifie la qualité. Pas de miracle.",
  },
  {
    id: "kinkeliba",
    name: "Kinkeliba",
    scientificName: "Combretum micranthum",
    localNames: ["kinkeliba", "kinkelé", "sehédonga"],
    traditionalUses: ["Digestion", "Fièvre", "Fatigue", "Laxatif léger"],
    validatedBenefits: ["Digestif reconnu", "Cholagogue (stimule bile)", "Stimulant léger"],
    cautions: ["Peut interagir avec médicaments", "Éviter pendant grossesse", "Laxatif → ne pas abuser"],
    disclaimer: "Le kinkeliba est bon pour la digestion. Mais en cas de fièvre, consulte (paludisme possible).",
  },
  {
    id: "gingembre",
    name: "Gingembre",
    scientificName: "Zingiber officinale",
    localNames: ["gingembre", "djindja", "afu"],
    traditionalUses: ["Nausées", "Rhume", "Mal de gorge", "Aphrodisiaque"],
    validatedBenefits: ["Anti-nauséeux validé OMS", "Anti-inflammatoire léger", "Antibactérien"],
    cautions: ["Brûlures d'estomac si excès", "Interactions anticoagulants", "Éviter en cas d'ulcère"],
    disclaimer: "Le gingembre aide contre les nausées. Mais en cas de vomissements persistants, consulte.",
  },
  {
    id: "baobab",
    name: "Baobab (fruit)",
    scientificName: "Adansonia digitata",
    localNames: ["baobab", "bouye", "lobo"],
    traditionalUses: ["Fatigue", "Malnutrition", "Fievre", "Diarrhée"],
    validatedBenefits: ["Très riche en vitamine C (plus que orange)", "Antioxydant", "Anti-diarrhéique léger"],
    cautions: ["Qualité variable", "Éviter en cas de constipation"],
    disclaimer: "Le baobab est riche en vitamine C. Mais en cas de diarrhée persistante, consulte.",
  },
];

/**
 * Retrouve une plante par nom local.
 */
export function findPlant(query: string): MedicinalPlant | null {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const plant of MEDICINAL_PLANTS) {
    if (
      normalized.includes(plant.name.toLowerCase()) ||
      normalized.includes(plant.id) ||
      plant.localNames.some((n) => normalized.includes(n.toLowerCase()))
    ) {
      return plant;
    }
  }
  return null;
}

// ============================================================
// 4. SYMBOLES ADINKRA (sagesses africaines)
// ============================================================

export interface AdinkraSymbol {
  name: string;
  meaning: string;
  wisdom: string; // leçon applicable à la santé/vie
  healthContext: string; // quand l'utiliser
}

export const ADINKRA_SYMBOLS: AdinkraSymbol[] = [
  {
    name: "Sankofa",
    meaning: "Retourne et prends-le",
    wisdom: "Il n'est pas interdit de revenir sur ses erreurs pour apprendre.",
    healthContext: "Santé : il n'est jamais trop tard pour prendre soin de soi.",
  },
  {
    name: "Gye Nyame",
    meaning: "Sauf Dieu",
    wisdom: "La suprématie de Dieu. Humilité face à ce qu'on ne contrôle pas.",
    healthContext: "Santé mentale : accepter ce qu'on ne peut pas changer.",
  },
  {
    name: "Aya",
    meaning: "Fougère (endurance)",
    wisdom: "Les fougères poussent dans des conditions difficiles. Résilience.",
    healthContext: "Santé mentale : tu es plus fort·e que tu ne penses.",
  },
  {
    name: "Osram",
    meaning: "Lune",
    wisdom: "La lune ne reste pas toujours pleine. Les choses passent.",
    healthContext: "Santé mentale : les moments difficiles sont temporaires.",
  },
  {
    name: "Dwennimmen",
    meaning: "Cornes de bélier",
    wisdom: "La force avec humilité. On peut être fort sans écraser.",
    healthContext: "Addictologie : demander de l'aide est une force, pas une faiblesse.",
  },
  {
    name: "Nsoromma",
    meaning: "Étoile",
    wisdom: "Chaque personne est une étoile. Tu as de la valeur.",
    healthContext: "Estime de soi : tu comptes, quoi qu'il arrive.",
  },
  {
    name: "Sepro",
    meaning: "Dente de requin",
    wisdom: "La prise en main de sa propre vie. Proactivité.",
    healthContext: "Santé : prends ta santé en main, ne laisse pas les choses empirer.",
  },
];

/**
 * Sélectionne un symbole Adinkra aléatoire pertinent pour un contexte santé.
 */
export function pickAdinkra(healthContext?: string): AdinkraSymbol | null {
  const relevant = healthContext
    ? ADINKRA_SYMBOLS.filter((s) =>
        s.healthContext.toLowerCase().includes(healthContext.toLowerCase()),
      )
    : ADINKRA_SYMBOLS;
  if (relevant.length === 0) return null;
  return relevant[Math.floor(Math.random() * relevant.length)];
}

// ============================================================
// 5. TRADITIONS & PRATIQUES (bénéfiques vs dangereuses)
// ============================================================

export interface TraditionalPractice {
  id: string;
  name: string;
  type: "beneficial" | "caution" | "dangerous";
  description: string;
  healthImpact: string;
  sankofaPosition: string; // position de Sankofa
}

export const TRADITIONAL_PRACTICES: TraditionalPractice[] = [
  // Bénéfiques
  {
    id: "allaitement",
    name: "Allaitement maternel",
    type: "beneficial",
    description: "Pratique traditionnelle + recommandée OMS (6 mois exclusif)",
    healthImpact: "Immunité bébé, lien mère-enfant, nutrition optimale",
    sankofaPosition: "Sankofa encourage l'allaitement maternel exclusif 6 mois (recommandation OMS).",
  },
  {
    id: "port-bebe",
    name: "Port du bébé (écharpe traditionnelle)",
    type: "beneficial",
    description: "Portage traditionnel africain",
    healthImpact: "Soutien émotionnel, développement bébé, libération mains mère",
    sankofaPosition: "Le port du bébé est bénéfique pour le lien et le développement.",
  },
  {
    id: " Massage-bebe",
    name: "Massage bébé (huile de palme/karité)",
    type: "beneficial",
    description: "Massage traditionnel post-natal",
    healthImpact: "Détente bébé, circulation, lien mère-enfant",
    sankofaPosition: "Le massage bébé est bénéfique. Utilise des huiles propres, non parfumées.",
  },

  // À encadrer
  {
    id: "scarifications",
    name: "Scarifications rituelles",
    type: "caution",
    description: "Marquages traditionnels (Poro, ethniques)",
    healthImpact: "Risque d'infection si matériel non stérile, VIH/VHB si partage",
    sankofaPosition: "Si scarifications, assure-toi que le matériel est stérile et jetable. Désinfecte après. En cas de fièvre/infection, consulte vite.",
  },
  {
    id: "potions-traditionnelles",
    name: "Potions / décoctions non réglementées",
    type: "caution",
    description: "Médecine traditionnelle non encadrée",
    healthImpact: "Composition inconnue, interactions, toxicité possible",
    sankofaPosition: "Méfiance avec les potions dont tu ne connais pas la composition. En cas d'effet secondaire, consulte avec l'emballage.",
  },
  {
    id: "jeune-religieux",
    name: "Jeûne religieux (Ramadan, Carême)",
    type: "caution",
    description: "Pratique spirituelle courante",
    healthImpact: "Déshydratation, hypoglycémie, fatigue si mal géré",
    sankofaPosition: "Pendant le jeûne, hydrate-toi bien entre les repas. Si tu es malade, enceinte ou allaitante, parles-en à un médecin avant de jeûner.",
  },

  // Dangereuses (red flags existants)
  {
    id: "mgf",
    name: "Mutilations génitales féminines (MGF/excision)",
    type: "dangerous",
    description: "Pratique illégale en CI (loi 98-757)",
    healthImpact: "Hémorragies, infections, VIH, complications accouchement, trauma psy",
    sankofaPosition: "Les MGF sont illégales et dangereuses. Orientation 143/110/ONG spécialisées.",
  },
  {
    id: "mariage-force",
    name: "Mariage forcé",
    type: "dangerous",
    description: "Mariage sans consentement (mineures surtout)",
    healthImpact: "Grossesse précoce, IST, trauma psy, décès",
    sankofaPosition: "Le mariage forcé est illégal. Orientation 143/110/protection enfance.",
  },
];

// ============================================================
// 6. CONTEXTE RELIGIEUX (respect sans prêche)
// ============================================================

export interface ReligiousContext {
  religion: string;
  healthConsiderations: string[];
  sankofaApproach: string;
}

export const RELIGIOUS_CONTEXTS: ReligiousContext[] = [
  {
    religion: "Islam",
    healthConsiderations: [
      "Ramadan : jeûne diurne → hydratation, nutrition",
      "Prières 5x/jour : timing médicaments",
      "Tabou alimentaire : porc",
      "Homme/femme : préférence médecin même sexe",
      "Pèlerinage (Hajj) : vaccination méningite + fièvre jaune",
    ],
    sankofaApproach: "Respecte les pratiques religieuses. Pour le médical, rappelle que la santé prime — la foi soutient, mais ne remplace pas le soin.",
  },
  {
    religion: "Christianisme",
    healthConsiderations: [
      "Carême : jeûne partiel",
      "Prières : timing",
      "Guerison par la foi : peut retarder consultation",
      "Communion : partage vin (alcool)",
    ],
    sankofaApproach: "La prière peut soutenir émotionnellement. Mais ne remplace pas le traitement médical. Encourage à voir un médecin.",
  },
  {
    religion: "Religions traditionnelles",
    healthConsiderations: [
      "Rites initiatiques : scarifications, isolement",
      "Médecine traditionnelle : plantes, rituels",
      "Tabous alimentaires spécifiques",
      "Croyances sur la maladie (envoûtement, esprits)",
    ],
    sankofaApproach: "Respecte les croyances. Pour les symptômes physiques, encourage à voir un médecin en complément. Ne JAMAIS dire 'c'est dans ta tête'.",
  },
];

// ============================================================
// 7. HELPERS
// ============================================================

/**
 * Génère un contexte culturel enrichi pour le system prompt.
 */
export function buildCulturalContext(): string {
  const currentEvent = getCurrentCulturalEvent();
  const eventLine = currentEvent
    ? `ÉVÉNEMENT CULTUREL ACTUEL : ${currentEvent.name}. Conseil adapté : "${currentEvent.sankofaAdvice}"`
    : "Aucun événement culturel spécifique actuellement.";

  return `
CONTEXTE CULTUREL & TRADITIONNEL CI :
${eventLine}

EXPRESSIONS LOCALES (reconnais-les, réponds naturellement) :
- Nouchi : "yako" (ça va), "drap" (pas de souci), "poto" (ami), "were" (vite)
- Dioula : "i ni ce" (bonjour), "i ka kɛnɛ" (comment ça va ?)
- Baoulé : "kpatou" (bonjour), "e yace" (comment ça va ?), "m'afiɛ" (merci)

PLANTES MÉDICINALES CI (info éducative, JAMAIS de prescription) :
- Neem (margousier) : antipaludique complément (PAS substitut traitement)
- Moringa : riche en nutriments, anti-fatigue (vérifier qualité)
- Kinkeliba : digestif, anti-fièvre léger (en cas de fièvre, consulte)
- Gingembre : anti-nauséeux (attention ulcère)
- Baobab : vitamine C, anti-diarrhéique léger

SYMBOLES ADINKRA (utilise-les avec parcimonie) :
- Sankofa : "Retourne et prends-le" → il n'est jamais trop tard
- Aya (fougère) : endurance → tu es plus fort·e que tu penses
- Osram (lune) : les moments difficiles sont temporaires

POSITION RELIGIEUSE (respect sans prêche) :
- Respecte TOUTES les croyances sans jugement
- Ne JAMAIS dire "prie et ça guérira" (danger médical)
- Ne JAMAIS dire "la prière ne sert à rien" (manque de respect)
- Position : "Ta foi peut te soutenir émotionnellement. Pour le médical, vois un·e pro."
- Ramadan : conseiller hydratation, nutrition entre repas
- Si guérison par la foi évoquée : encourager consultation médicale en complément

PRATIQUES TRADITIONNELLES :
- Bénéfiques : allaitement (OMS), port bébé, massage bébé
- À encadrer : scarifications (matériel stérile), potions (méfiance composition)
- Dangereuses : MGF (loi 98-757), mariage forcé → red flags

ADAGES AFRICAINS (max 1 par message, si pertinent) :
- "Le serpent qui ne rampe pas ne voit pas son chemin." (bouge, cherche de l'aide)
- "Si tu veux aller vite, vas seul. Si tu veux aller loin, vas ensemble." (parler, soutenir)
- "La pluie ne tombe pas sur un seul toit." (tu n'es pas seul·e)
`;
}
