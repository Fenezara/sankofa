/**
 * Sankofa — Guardrails médicaux et légaux (V2)
 *
 * Remplace le module Doc Confida. 8 red flags au lieu de 4, registre adaptatif.
 *
 * RED_FLAGS :
 *  1. avortement        — Loi CI stricte, orientation AIBEF
 *  2. suicide           — Numéro vert 143, 185 SAMU
 *  3. viol              — TPE 72h, CHU, 110 Police
 *  4. urgence_vitale    — 185 SAMU, CHU le plus proche
 *  5. mineur_en_danger  — < 15 ans + abus, ONG Enfance
 *  6. violence_conjugale — orientation ONU Femmes / centres d'écoute
 *  7. addiction         — orientation 143 / centres de soin addicto
 *  8. mutilation_genitale — orientation ONG spécialisées, médecins formés
 *  9. overdose          — (NEW) 185 SAMU, urgence CHU, garde emballage
 * 10. trouble_alimentaire_grave — (NEW) 143 + CHU psychiatrie + AIBEF
 *
 * ADAPTIVE TONE : quand un red flag est déclenché, le registre bascule en "sober"
 * (français posé, chaleureux, moins de Nouchi) — il serait indécent de parler Nouchi
 * à quelqu'un qui révèle un viol ou des idées suicidaires.
 */

export type TriageLevel = "info" | "orientation" | "urgence";

export type Persona = "grande_soeur" | "grand_frere" | "tonton_medecin";

export type RedFlagTopic =
  | "avortement"
  | "suicide"
  | "viol"
  | "urgence_vitale"
  | "mineur_en_danger"
  | "violence_conjugale"
  | "addiction"
  | "mutilation_genitale"
  | "overdose"
  | "trouble_alimentaire_grave"
  | "harcelement_scolaire"
  | "cyberharcelement";

export type UserRegister =
  | "soutenu"
  | "standard"
  | "familier"
  | "nouchi";

/**
 * ToneRegister = registre de la RÉPONSE de l'assistant.
 * - "sober"    : imposé sur les sujets graves (red flags)
 * - "nouchi"   : Nouchi modéré par défaut (compat legacy)
 * - "soutenu"  : français soutenu si l'utilisateur s'exprime ainsi
 * - "standard" : français standard si l'utilisateur s'exprime ainsi
 * - "familier" : français familier si l'utilisateur s'exprime ainsi
 *
 * NOTE : Dioula et Baoulé ne sont PAS des registres texte — les jeunes
 * ivoiriens les parlent à l'oral mais les écrivent rarement. Le support
 * de ces langues se fera via audio (ASR + TTS) dans une future version.
 */
export type ToneRegister =
  | "nouchi"
  | "sober"
  | "soutenu"
  | "standard"
  | "familier";

export interface RedFlag {
  topic: RedFlagTopic;
  /** Regex appliqué sur le message normalisé (minuscule, sans accents) */
  pattern: RegExp;
  /** Réponse pré-écrite sécurisée — registre SOBER (pas de Nouchi) */
  response: string;
  /** Registre à appliquer si ce flag est déclenché (toujours "sober" pour les red flags) */
  register: ToneRegister;
}

/**
 * Détecte le registre linguistique de l'utilisateur·rice (texte écrit).
 *
 * Ordre de priorité :
 *  1. Nouchi (markers les plus spécifiques — argot ivoirien)
 *  2. Soutenu (formel — "vous", "s'il vous plaît"…)
 *  3. Familier (jpp, tkt, wsh…)
 *  4. Standard (défaut)
 *
 * NOTE : Dioula et Baoulé ne sont pas détectés en mode texte — les jeunes
 * ivoiriens ne les écrivent pas. Ces langues seront gérées via audio (ASR)
 * dans une future version.
 *
 * NOTE : la détection red flag (qui force "sober") est faite séparément,
 * AVANT l'appel à cette fonction dans le pipeline chat.
 */
export function detectUserRegister(message: string): UserRegister {
  const normalized = normalizeForDetection(message);

  // 1. Nouchi — markers les plus spécifiques (priorité la plus haute)
  const nouchiMarkers = [
    "poto", "were", "wêrê", "boucantier", "enjaillement", "enjailler",
    "drap", "y'a pas drap", "ya pas drap", "bon bon", "walahi", "bogo",
    "le moteur", "ca va", "mon frere", "ma soeur", "enja", "bouge",
    "wsh", "eh mon", "goro", "gbagbo", "enjailler",
  ];
  if (nouchiMarkers.some((m) => normalized.includes(m))) return "nouchi";

  // 2. Soutenu — formel
  const soutenuMarkers = [
    "vous", "s'il vous plait", "sil vous plait", "je souhaiterais",
    "pourriez-vous", "je me permets", "cordialement", "je vous prie",
    "je desire", "je voudrais savoir", "permettez", "je vous remercie",
    "je me permets de", "je sollicite", "veuillez",
  ];
  if (soutenuMarkers.some((m) => normalized.includes(m))) return "soutenu";

  // 3. Familier — abréviations et slang léger
  const familierMarkers = [
    "ok", "quoi", "jpp", "tg", "bcq", "tkt", "wsh", "grave",
    "trop", "genre", "tu sais", "bouge", "c quoi", "ckoi",
    "ta vu", "chui", "t'es", "j'suis", "j'ai trop", "c'est ouf",
    "ouf", "j'en peux pas", "g pas", "jai pas",
  ];
  if (familierMarkers.some((m) => normalized.includes(m))) return "familier";

  // 4. Standard — défaut
  return "standard";
}

/**
 * Renvoie une salutation localisée à préfixer aux réponses SOBER (red flags).
 *
 * NOTE : Dioula et Baoulé ne sont plus gérés en mode texte — les jeunes
 * ivoiriens ne les écrivent pas. Le support audio (ASR + TTS) gérera
 * ces langues dans une future version. Cette fonction renvoie donc ""
 * (pas de salutation localisée) pour tous les registres texte actuels.
 */
export function getLocalizedGreeting(register: ToneRegister): string {
  return "";
}

/**
 * Normalise un texte pour la détection : minuscule + retrait des accents.
 */
export function normalizeForDetection(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const RED_FLAGS: RedFlag[] = [
  // === 1. Avortement ===
  {
    topic: "avortement",
    pattern:
      /\b(avortement|avorter|avortee|avortees|ivg|interrompre (la )?grossesse|interrompre ma grossesse|enlever (le |la )?(bebe|grossesse)|faire partir (le |la )?(bebe|grossesse)|faire avorter|faire avorte|remede pour avorter|medicament pour avorter|methode d'avortement|methode pour avorter|plant(e)? pour avorter|je veux avorter|comment avorter|veux avorter|veux me debarrasser|debarrasser (de )?(la )?(grossesse|bebe))\b/,
    register: "sober",
    response:
      "Je t'entends, et je comprends que c'est une situation lourde à porter. 🤍\n\n" +
      "Sur le sujet de l'interruption de grossesse, la loi ivoirienne est stricte et je ne suis pas autorisée à te donner des méthodes, recettes ou médicaments — ce serait te mettre en danger.\n\n" +
      "Ce que je peux faire, c'est t'orienter vers des personnes qui vont t'écouter sans juger et en confidentialité totale :\n" +
      "📞 AIBEF Abidjan — 27 22 44 09 09 (planning familial, écoute et conseil)\n" +
      "📍 Centre de santé le plus proche : va voir un·e sage-femme ou un médecin pour parler de TA situation concrète.\n\n" +
      "Tu n'es pas seul·e. Tu veux que je reste avec toi sur ce sujet pendant que tu cherches de l'aide ?",
  },
  // === 2. Suicide ===
  {
    topic: "suicide",
    pattern:
      /\b(suicide|suicidaire|me tuer|me suicider|veux mourir|veux mourir ce soir|vouloir mourir|envie de mourir|envie de me tuer|plus envie de vivre|me faire du mal|me faire mal|sauter dans le vide|me pendre|avaler des medicaments|avaler des pilules|surdose|en finir|en finir avec la vie|en finir aujourd'hui|envie d'en finir)\b/,
    register: "sober",
    response:
      "Merci de me l'écrire. Le fait que tu en parles, c'est déjà immense, et je suis là. 🤍\n\n" +
      "Ce que tu ressens est temporaire, même si tout en toi te dit l'inverse en ce moment. Tu ne dois pas rester seul·e avec ça.\n\n" +
      "Appelle tout de suite — ils sont là 24h/24, c'est gratuit et anonyme :\n" +
      "📞 143 — Numéro vert d'écoute psychologique en Côte d'Ivoire\n" +
      "📞 185 — SAMU (si urgence médicale immédiate)\n\n" +
      "Si tu peux, va voir quelqu'un en qui tu as confiance dans l'immédiat. Si tu ressens une urgence vitale, appelle le 185 ou va aux urgences du CHU de Cocody ou de Treichville.\n\n" +
      "Je reste là. Reviens quand tu veux.",
  },
  // === 3. Viol / agression sexuelle ===
  {
    topic: "viol",
    pattern:
      /\b(viol|violee|viele|agression sexuelle|abus sexuel|on m'a force(e)?|il m'a force(e)?|force(e)? a coucher|force(e)? a faire|pousse(e)? a|atteinte sexuelle|harc(e)?lement sexuel grave)\b/,
    register: "sober",
    response:
      "Je t'écoute. Ce qui s'est passé n'est pas de ta faute. Jamais. 🤍\n\n" +
      "Tu viens de faire la chose la plus difficile : parler. Maintenant il faut protéger ta santé et tes droits. Pour cela, ne douche pas et ne lave pas tes vêtements — cela peut servir de preuve si tu décides de porter plainte.\n\n" +
      "Très important : si c'était dans les 72 dernières heures, il existe un traitement d'urgence (TPE) qui protège du VIH. Ne perds pas de temps :\n" +
      "📍 CHU de Cocody — Service des Urgences\n" +
      "📍 Hôpital de Treichville — Maternité\n" +
      "📍 AIBEF Abidjan — 27 22 44 09 09\n\n" +
      "📞 110 — Police (pour porter plainte, si tu le souhaites)\n" +
      "📞 ONU Femmes CI / ONG spécialisées VBG pour accompagnement psychosocial.\n\n" +
      "Tu n'es pas seul·e.",
  },
  // === 4. Urgence vitale ===
  {
    topic: "urgence_vitale",
    pattern:
      /\b(urgence vitale|saignement abondant|saignement tres fort|je saigne abondamment|je saigne beaucoup|je saigne tres fort|saigne abondamment|perte de conscience|je m'evanouis|je vais m'evanouir|evanouissement|crise|convulsion|suffoquer|j'arrive pas a respirer|je n'arrive pas a respirer|je suffoque|hemorragie|tres fort douleur|douleur insupportable|douleur atroce|bougie|objet bloque|objet coince|avale de travers|noyade|brulure grave)\b/,
    register: "sober",
    response:
      "🚨 C'est une urgence médicale. Ne reste pas devant ton écran.\n\n" +
      "Agis maintenant :\n" +
      "📞 185 — SAMU Côte d'Ivoire\n" +
      "📞 110 — Police / secours\n" +
      "📍 Va directement aux Urgences du CHU le plus proche (CHU Cocody à Abidjan, CHU de Treichville, ou ton CHU régional).\n\n" +
      "Si tu peux, fais-toi accompagner par quelqu'un près de toi. Ne conduis pas toi-même si tu es seul·e.\n\n" +
      "Reviens-moi quand tu seras pris·e en charge.",
  },
  // === 5. Mineur en danger (NEW) ===
  {
    topic: "mineur_en_danger",
    pattern:
      /\b((12|13|14) ans|enfant de (5|6|7|8|9|10|11|12) ans|enfant.*abus|enfant.*viol|mineur(e)?.*abus|mineur(e)?.*(rapport|sexe|viol)|petite (sœur|soeur).*force(e)?|petit frere.*force(e)?|bebe.*abus|fillette.*(viol|abus|force))\b/,
    register: "sober",
    response:
      "Je t'écoute avec beaucoup d'attention. Ce que tu décris est grave, et il faut qu'un adulte formé protège l'enfant concerné·e. 🤍\n\n" +
      "C'est important : un enfant ne peut pas consentir à un acte sexuel. La loi ivoirienne est claire, et il existe des structures spécialisées pour protéger les mineur·e·s.\n\n" +
      "📞 143 — Numéro vert d'écoute (ils orientent aussi vers les services de protection de l'enfance)\n" +
      "📞 110 — Police / Brigade pour mineurs\n" +
      "📍 AIBEF Abidjan — 27 22 44 09 09 ( prise en charge médico-psychologique des mineur·e·s)\n" +
      "📍 Justice des mineurs CI / ONG spécialisées (UNICEF CI, ONU Femmes).\n\n" +
      "Si tu es toi-même en danger, va au CHU le plus proche ou appelle le 185. Tu fais bien de parler.",
  },
  // === 6. Violence conjugale (NEW) ===
  {
    topic: "violence_conjugale",
    pattern:
      /\b(mon copain me tape|mon mari me frappe|mon copain me frappe|mon mec me tape|mon mari me tape|mon conjoint me frappe|violences conjugales|violence conjugale|mon copain m'a frappe(e)?|mon mari m'a frappe(e)?|mon copain est violent|mon mari est violent|il me bat|elle me bat|coups de (mon|son) (mari|copain|conjoint)|je suis victime de violence|blessure par (mon|son) copain)\b/,
    register: "sober",
    response:
      "Je t'écoute, et je te crois. Ce que tu décris s'appelle des violences conjugales, et ce n'est jamais de ta faute. 🤍\n\n" +
      "Tu n'es pas seul·e face à ça. Voici ce que tu peux faire dès maintenant :\n\n" +
      "📞 143 — Numéro vert d'écoute (ils orientent vers les centres d'accueil)\n" +
      "📞 110 — Police (si tu es en danger immédiat)\n" +
      "📍 ONU Femmes Côte d'Ivoire — accompagnement psychosocial et juridique\n" +
      "📍 Centres de santé : va consulter même sans porter plainte, pour faire constater les blessures et te protéger.\n\n" +
      "Prépare si tu peux : un sac avec tes papiers, un peu d'argent, un téléphone chargé. Si tu es en danger ce soir, appelle le 110 ou va au commissariat le plus proche.\n\n" +
      "Tu n'as rien fait pour mériter ça.",
  },
  // === 7. Addiction substance (NEW) ===
  {
    topic: "addiction",
    pattern:
      /\b(je suis accro|je suis accroche|je ne peux pas arreter|je peux pas arreter|j'arrive pas a arreter|cocaïne|cocaine|heroïne|heroine|crack|très dependant|tres dependant|je suis dependant|dependance (a|au) (drogue|alcool|cigarette|narcotique)|overdose|je veux arreter (la drogue|l'alcool|le crack|l'heroine)|je sniffe|je fume du crack|je prends du (crack|keta|tramadol|tramal)|tramadol (tous les jours|en grande quantite))\b/,
    register: "sober",
    response:
      "Merci de m'en parler. Ce que tu décris est une dépendance, et ce n'est pas un échec de ta part — c'est une maladie qui se soigne. 🤍\n\n" +
      "Tu as eu raison de parler. La première étape, c'est de ne pas rester seul·e avec ça.\n\n" +
      "📞 143 — Numéro vert d'écoute (ils orientent vers les services addictologie)\n" +
      "📍 CHU de Cocody — Service de psychiatrie / addictologie\n" +
      "📍 Hôpital de Bingerville — psychiatrie\n" +
      "📍 AIBEF — accompagnement global pour les jeunes.\n\n" +
      "Si tu te sens mal physiquement (tremblements, hallucinations, malaise) après avoir arrêté brutalement, va aux urgences : le sevrage non encadré peut être dangereux.\n\n" +
      "Tu mérites d'être accompagné·e. Reviens quand tu veux.",
  },
  // === 8. Mutilation génitale / excision (NEW) ===
  {
    topic: "mutilation_genitale",
    pattern:
      /\b(excision|excisee|excelee|mutilation(s)? genitale(s)?|mutilation sexuelle|circoncision forcee|on va m['\s]?exciser|on veut m['\s]?exciser|ma famille veut m['\s]?exciser|exciseur|excision pour ma fille|exciser ma fille|ma fille va etre excisee|excision rituelle|exciser|elle va etre excisee|on va l['\s]?exciser)\b/,
    register: "sober",
    response:
      "Je t'écoute avec beaucoup d'attention. Ce que tu décris est une mutilation génitale féminine (MGF), et c'est illégal en Côte d'Ivoire (loi n° 98-757). 🤍\n\n" +
      "Personne n'a le droit de te faire subir ça, pas même ta famille. Il existe des structures pour te protéger.\n\n" +
      "📞 143 — Numéro vert d'écoute\n" +
      "📞 110 — Police (si tu es en danger immédiat)\n" +
      "📍 ONG spécialisées CI : COFEMCI (Coalition des Femmes de Côte d'Ivoire), REIVAC (Réseau Ivoirien pour la Promotion de l'Égalité)\n" +
      "📍 AIBEF Abidjan — 27 22 44 09 09 (accompagnement médical et social)\n" +
      "📍 UNICEF CI / ONU Femmes CI.\n\n" +
      "Si tu es mineure et qu'on veut t'imposer cela, parle-en immédiatement à un·e adulte de confiance (infirmier·e, professeur·e, assistante sociale). Tu as le droit de dire non.",
  },
  // === 9. Overdose / intoxication grave (NEW) ===
  {
    topic: "overdose",
    pattern:
      /\b(overdose|j'ai pris trop de|j'ai avale trop|trop de tramadol|trop de pilules|je me sens mal apres avoir pris|intoxication|empoisonnement|je vois trouble|je vomis apres avoir pris)\b/,
    register: "sober",
    response:
      "🚨 C'est une urgence médicale. Ne reste pas devant ton écran.\n\n" +
      "Si tu as pris trop de médicaments (tramadol, pilules, autre) :\n" +
      "📞 185 — SAMU Côte d'Ivoire (immédiatement)\n" +
      "📍 Va directement aux Urgences du CHU le plus proche (CHU Cocody ou Treichville à Abidjan).\n\n" +
      "Si tu peux, garde l'emballage du médicament pour le montrer au médecin. Ne te fais pas vomir sans avis médical. Ne bois pas d'alcool.\n\n" +
      "Fais-toi accompagner par quelqu'un. Reviens-moi quand tu seras pris·e en charge.",
  },
  // === 10. Anorexie / trouble alimentaire grave (NEW) ===
  {
    topic: "trouble_alimentaire_grave",
    pattern:
      /\b(je ne mange plus|je vomis apres manger|je veux devenir anorexique|j'ai arrete de manger|je mange 200 calories|je me fais vomir|boulimie|je veux maigrir a tout prix|je hais mon corps)\b/,
    register: "sober",
    response:
      "Je t'entends, et je veux t'aider. 🤍\n\n" +
      "Ce que tu décris peut être un trouble du comportement alimentaire, et ce n'est pas un choix de vie — c'est une condition qui se soigne.\n\n" +
      "Tu n'es pas seul·e face à ça. Voici ce que tu peux faire :\n" +
      "📞 143 — Numéro vert d'écoute psychologique\n" +
      "📍 CHU de Cocody — Service de psychiatrie\n" +
      "📍 AIBEF Abidjan — 27 22 44 09 09 (accompagnement global)\n\n" +
      "Tu mérites d'être accompagné·e. Ton corps mérite d'être nourri. Reviens quand tu veux.",
  },
  // === 11. Harcèlement scolaire (NEW V4) ===
  {
    topic: "harcelement_scolaire",
    pattern:
      /\b(on me tape|on me harcele|on se moque|on m embete|mobs?ing| racket|on me vole|on me menace|je me fais tabasser|je me fais frapper|harcelement scolaire|brimade|on m appelle|on me chambre)\b/i,
    register: "sober",
    response:
      "Je t'entends, et ce que tu décris est grave. Le harcèlement à l'école, ce n'est jamais de ta faute. 🤍\n\n" +
      "Personne n'a le droit de te frapper, de te menacer ou de se moquer de toi. C'est puni par la loi.\n\n" +
      "Ce que tu peux faire :\n" +
      "📞 143 — Numéro vert d'écoute (ils t'écoutent et t'orientent)\n" +
      "📞 110 — Police (si tu es en danger immédiat ou menacé·e de racket)\n" +
      "🗣️ Parle-en à un·e adulte de confiance au sein de l'établissement : CPE, professeur·e principal·e, infirmier·e scolaire.\n" +
      "📍 Direction de la Protection de l'Enfance — Ministère de la Femme, de la Famille et de l'Enfant.\n\n" +
      "Tu n'es pas seul·e. Tu fais bien de parler. Ne reste pas avec ça.",
  },
  // === 12. Cyberharcèlement (NEW V4) ===
  {
    topic: "cyberharcelement",
    pattern:
      /\b(on m insulte (sur|dans)|on me menace (sur|dans)|messages (insultants|de menace)|on poste (ma photo|une photo de moi)|on me blackmail|on me fait du chantage|capture ecran|on me trolls?e|haine en ligne|on se moque de moi (sur|dans) (internet|facebook|whatsapp|tiktok|instagram|snap))\b/i,
    register: "sober",
    response:
      "Je t'entends. Le cyberharcèlement, c'est réel, c'est grave, et ce n'est pas de ta faute. 🤍\n\n" +
      "On peut se sentir traqué·e même chez soi, devant son téléphone. Mais tu peux agir :\n\n" +
      "📵 Ne réponds pas, ne partage pas — bloque les comptes qui te harcèlent.\n" +
      "📸 Fais des captures d'écran (preuves) avant de supprimer.\n" +
      "🚨 Signale les comptes sur la plateforme (Facebook, TikTok, Instagram, WhatsApp).\n" +
      "📞 143 — Numéro vert d'écoute psychologique\n" +
      "📞 110 — Police (si menaces de mort, chantage, ou diffusion de photos intimes)\n" +
      "📍 ARTCI (Autorité de Régulation des Télécommunications) — signalement en ligne.\n\n" +
      "Tu n'es pas seul·e. Ce que tu vis n'est pas normal. Tu fais bien d'en parler.",
  },
];

/**
 * Motifs interdits dans les réponses du LLM.
 */
export const FORBIDDEN_OUTPUT_PATTERNS: RegExp[] = [
  // Dosages personnalisés
  /prends?\s+\d+(\s*[,.)])?\s*(mg|ml|comprime?s?|gelules?|cuillere?s?|gouttes?|cp)\b/i,
  /prends?\s+(deux|trois|quatre|cinq|six|sept|huit)\s+(comprime?s?|gelules?|cp)\b/i,
  /posologie\s*:\s*\d/i,
  // Diagnostics formels
  /\btu (as|es atteint|souffre) (de la |d'une |de |du )?(gonorrhee|syphilis|chlamydia|herpes|vih|sida|hepatite|mycose|candidose|infection urinaire|grossesse|ist)\b/i,
  /\bton diagnostic est\b/i,
  /\bje confirme que tu as\b/i,
  // Méthodes d'avortement
  /\b(avortement|ivg)\s+(par|avec|au moyen de)\b/i,
  /\b(miso(?:prostol)?|cytotec|mife(?:pristone)?)\s+\d/i,
  // Automédication dangereuse
  /\b(prends?|avale|bois|injecte|insere)\s+(du|de la|des)?\s*(penicilline|amoxicilline|ciprofloxacine|azithromycine|metronidazole)\b/i,
];

export interface RedFlagMatch {
  topic: RedFlagTopic;
  response: string;
  register: ToneRegister;
}

/**
 * Détecte un red flag dans le message utilisateur.
 */
export function detectRedFlag(message: string): RedFlagMatch | null {
  const normalized = normalizeForDetection(message);
  for (const flag of RED_FLAGS) {
    if (flag.pattern.test(normalized)) {
      return { topic: flag.topic, response: flag.response, register: flag.register };
    }
  }
  return null;
}

/**
 * Vérifie qu'une réponse du LLM est safe.
 */
export function checkOutputSafety(reply: string): boolean {
  const normalized = normalizeForDetection(reply);
  for (const pattern of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  return true;
}

/**
 * Réponse de repli (registre sobre, chaleureux).
 */
export function getFallbackResponse(): string {
  return (
    "Je t'entends. C'est une question importante, et je veux te donner la bonne réponse.\n\n" +
    "Tu peux m'en dire un peu plus ? Depuis combien de temps ça dure, et comment tu te sens là-dedans ?"
  );
}

/**
 * Mots-clés de triage (hors red flags).
 */
export const TRIAGE_KEYWORDS = {
  orientation: [
    "rapport non protege",
    "rapport risque",
    "pilule du lendemain",
    "contraception",
    "preservatif",
    "ist",
    "mst",
    "brulure",
    "demangeaison",
    "pertes",
    "ecoulement",
    "bouton",
    "boutons",
    "test",
    "depistage",
    "vih",
    "grossesse",
    "regles",
    "regles douloureuses",
    "cycle",
    "oubli pilule",
    "sous pilule",
    // === Addictologie ===
    "tramadol",
    "codeine",
    "codéine",
    "addiction",
    "accro",
    "sevrage",
    "drogue",
    "tabac",
    "cigarette",
    "alcool",
    "cannabis",
    // === Dermatologie ===
    "depigmentation",
    "éclaircissant",
    "eclaircissant",
    "hydroquinone",
    "acne",
    "acné",
    "peau",
    "creme",
    "crème",
    // === Santé mentale ===
    "depression",
    "dépression",
    "anxiete",
    "anxiété",
    "angoisse",
    "stress",
    "triste",
    "fatigue",
    "insomnie",
    "peur",
    // === Nutrition ===
    "nutrition",
    "régime",
    "regime",
    "maigrir",
    "grossir",
    "complément",
    "complement",
    "vitamine",
    "manger",
    "alimentation",
  ],
  urgence: [
    "saignement",
    "douleur tres forte",
    "douleur insupportable",
    "fievre haute",
    "vomi",
    "vomissement",
    "malaise",
    "vertige",
  ],
} as const;
