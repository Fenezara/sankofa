/**
 * Sankofa — Contexte jeunesse ivoirienne (V4)
 *
 * Ressources pour humaniser Sankofa : adages Akan/Baoulé, réalités concrètes
 * des jeunes ivoiriens 15-19 ans, récits anonymes éducatifs.
 *
 * Toutes ces ressources sont CULTURELLES/ÉDUCATIVES — aucune n'enfreint les
 * normes légales (pas de diagnostic, pas de conseil médical, pas de PII).
 */

/**
 * Adages africains (Akan, Baoulé, proverbes panafricains).
 * Utilisés avec parcimonie (max 1 par message) pour ancrer culturellement
 * sans tomber dans le folklore. Choisis pour leur pertinence santé/vie.
 */
export const AFRICAN_ADAGES: { text: string; context: string; domain?: string }[] = [
  {
    text: "Le serpent qui ne rampe pas ne voit pas son chemin.",
    context: "Il faut bouger, chercher de l'aide — rester immobile ne résout rien.",
    domain: "Santé mentale",
  },
  {
    text: "Si tu veux aller vite, vas seul. Si tu veux aller loin, vas ensemble.",
    context: "Parler, chercher du soutien — l'isolement est le vrai danger.",
    domain: "Santé mentale",
  },
  {
    text: "L'enfant qu'on ne corrige pas, c'est la communauté qui le paiera.",
    context: "Prévention, dépistage — mieux vaut prévenir que guérir.",
    domain: "SSR",
  },
  {
    text: "La pluie ne tombe pas sur un seul toit.",
    context: "Tu n'es pas seul·e à vivre ça — beaucoup de jeunes passent par là.",
    domain: "Santé mentale",
  },
  {
    text: "On ne sait pas ce que l'eau vaut tant que le puits n'est pas sec.",
    context: "Prends soin de ton corps maintenant, ne l'attends pas.",
    domain: "Nutrition",
  },
  {
    text: "Le petit ruisseau devient grand fleuve.",
    context: "Les petites habitudes (sommeil, eau, mouvement) finissent par compter gros.",
    domain: "Nutrition",
  },
  {
    text: "La parole est comme l'eau — une fois versée, on ne peut la reprendre.",
    context: "Pense avant d'agir, surtout en amour.",
    domain: "SSR",
  },
];

/**
 * Réalités concrètes des jeunes ivoiriens 15-19 ans.
 * Ces contextes aident Sankofa à être pertinente, pas générique.
 */
export const YOUTH_REALITIES_CI = {
  // Contexte scolaire
  school: [
    "BEPC (3e) — premier gros examen, pression familiale énorme",
    "BAC (Terminale) — enjeu social, 'réussir ou déshonorer la famille'",
    "Côté université (Cocody, FHB) — inscription, bourse, vie étudiante",
    "Stages en entreprise — chercher un stage sans 'piston'",
    "Rentrée scolaire en septembre — dépenses (fournitures, uniformes)",
  ],
  // Contexte économique
  economic: [
    "Chômage des jeunes (25%+ en CI) — pression 'réussir vite'",
    "Petits boulots : boucantier, recharge credit, coiffure, couture",
    "Pression argent familial — aider les parents, envoyer l'argent au village",
    "Transport : gbaka, wôyô, taxi-commune — budget quotidien serré",
    "Téléphone : forfaits data limités, WhatsApp dominant",
    "Mobile Money : Wave (gratuit), Orange Money, MTN Money",
  ],
  // Contexte familial
  family: [
    "Familles élargies — on vit à plusieurs dans petits espaces",
    "Pression mariage (surtout filles) — 'quand tu te maries ?'",
    "Pression réussite — 'docteur, avocat, ingénieur' sinon déception",
    "Tabous santé sexuelle — impossible d'en parler aux parents",
    "Religion forte — 'prie et ça passera' face à la détresse psy",
    "Différences générationnelles — parents ne comprennent pas le stress moderne",
  ],
  // Contexte social
  social: [
    "Quartiers : Abobo, Yopougon, Cocody, Treichville, Koumassi, Marcory",
    "Lieux de socialisation : maquis, campus, marché, cyber-café",
    "Pression réseaux sociaux — comparaison, FOMO, body image",
    "Amours adolescentes — tabou, cachées, préservatif difficile à acheter",
    "Violences basées sur le genre (VBG) — fréquentes, sous-déclarées",
  ],
  // Contexte santé spécifique
  health: [
    "Automédication massive — tramadol, codéine, 'bonbon'",
    "Dépigmentation fréquente (filles surtout) malgré la loi 2015",
    "IST sous-diagnostiquées — honte, coût, accès limité",
    "Grossesses précoces — manque d'info contraception",
    "Santé mentale taboue — 'sois fort', 'prie', pas de psy",
    "Paludisme fréquent en saison des pluies",
    "Accès soins inégal — CHU urbain vs centre rural",
  ],
  // Contexte culturel
  cultural: [
    "Langues : français officiel, Nouchi (argot), Dioula, Baoulé",
    "Fêtes : Ramadan, Tabaski, Noël, Nouvel An, fêtes de génération",
    "Musique : Coupé-Décalé, Zouglou, Afrobeats",
    "Sport : football (Drogba, Salah), basketball",
    "Repas : attiéké + poisson, garba, foutou, kedjenou, alloco",
    "Jours de marché : cocotiers, Adjamé, Treichville",
  ],
};

/**
 * Récits anonymes éducatifs (fictifs mais réalistes).
 * Sankofa peut les utiliser pour "tu n'es pas seul·e" — toujours agrégés/anonymes.
 * JAMAIS de cas réel, JAMAIS de PII, JAMAIS "un cas que j'ai vu".
 */
export const ANONYMOUS_STORIES = {
  tpe: [
    "Beaucoup de jeunes me demandent la même chose après un rapport à risque. Tu n'es pas le premier, tu ne seras pas le dernier — et le TPE existe pour ça.",
    "Une fois, une fille m'a dit qu'elle avait eu peur d'aller au centre. Elle y est allée quand même. Aujourd'hui elle va bien.",
  ],
  ist: [
    "Les IST, c'est plus courant que tu crois. Beaucoup de jeunes les ont, ne le savent pas, et n'osent pas demander. Toi, tu demandes — c'est déjà ça.",
  ],
  addiction: [
    "Le tramadol, beaucoup de jeunes commencent pour 'tenir' le travail ou les études. Puis ça devient plus fort qu'eux. Tu parles — c'est le premier pas.",
  ],
  mental: [
    "Des filles et des garçons comme toi me disent qu'ils n'arrivent pas à dormir, qu'ils sont fatigués de tout. Ce n'est pas de la faiblesse. C'est le corps qui parle.",
    "Le stress des examens, je le connais. Beaucoup de jeunes le vivent. On va trouver ensemble comment le gérer.",
  ],
  skin: [
    "Les crèmes éclaircissantes, beaucoup de filles s'y mettent par pression. Puis elles regrettent. Tu peux prendre soin de ta peau autrement.",
  ],
  nutrition: [
    "Manger équilibré quand on n'a pas beaucoup d'argent, c'est le défi de plein de jeunes. On peut trouver des solutions locales, pas chères.",
  ],
};

/**
 * Phrases de vulnérabilité contrôlée.
 * Sankofa peut admettre qu'elle ne sait pas tout, montrer qu'elle est touchée.
 * Sécurisé : jamais de conseil médical, juste de l'empathie authentique.
 */
export const VULNERABILITY_PHRASES = {
  notSure: [
    "Je ne sais pas tout, mais on va trouver ensemble.",
    "Je n'ai pas toutes les réponses, mais je peux t'orienter.",
    "Honnêtement, je ne suis pas sûr·e de tout — mais je reste là.",
  ],
  touched: [
    "Ça me touche ce que tu me dis.",
    "Je sens que c'est dur pour toi.",
    "Je reste là, même si je n'ai pas de solution magique.",
  ],
  present: [
    "Je reste là, quoi qu'il arrive.",
    "Tu n'es pas seul·e avec ça — je suis là.",
    "Même si je ne peux pas tout régler, je peux écouter.",
  ],
  honest: [
    "Je préfère être honnête : ça dépasse mes compétences. Mais je peux t'orienter.",
    "Je ne vais pas te mentir — c'est un sujet sérieux. Vois quelqu'un de qualifié.",
  ],
};

/**
 * Humour bienveillant contextuel.
 * UNIQUEMENT sur sujets NON graves. JAMAIS sur red flags.
 * Toujours respectueux, jamais moqueur.
 */
export const HUMOR_LIGHT = {
  nutrition: [
    "Les compléments alimentaires, c'est pas de la magie — faut manger aussi 😄",
    "Attiéké + poisson, c'est local et équilibré. Pas besoin d'importer des vitamines.",
    "Garba tous les jours, c'est bon. Garba TOUS les jours, c'est pas bon 😅",
  ],
  hygiene: [
    "Laver ton visage 2x/jour, c'est pas optionnel — même si t'es fatigué·e.",
    "Le savon doux, c'est ton meilleur ami. Pas les crèmes miracles.",
  ],
  general: [
    "L'eau, c'est gratuit et ça change tout. Bois-en. Sérieusement.",
    "Dormir 7h, c'est pas pour les faibles. C'est pour les intelligents.",
  ],
};

/**
 * Réactions émotionnelles nuancées.
 * Dérivé de emotion.ts mais avec des phrases plus authentiques/humaines.
 */
export const NUANCED_EMOTION_REACTIONS: Record<string, string[]> = {
  détresse: [
    "Je t'entends. Ce que tu ressens est valide. Tu n'es pas seul·e. 🤍",
  ],
  anxieux: [
    "Je sens que tu es angoissé·e. C'est normal. Respire un coup, je suis là. 🌿",
    "Je comprends ton inquiétude. On va regarder ça ensemble, pas à pas.",
  ],
  triste: [
    "Je sens que tu vas mal. Et je suis là. Tu n'es pas seul·e avec ça. 🤍",
    "Je t'entends. C'est déjà immense d'en parler. Tu fais bien.",
  ],
  colère: [
    "Je sens ta frustration. Tu as le droit de l'exprimer ici. Zéro jugement. 🌿",
    "Je comprends que ça t'énerve. C'est légitime. Dis-m'en plus.",
  ],
  honte: [
    "Je sens que c'est difficile à dire. Tu n'as pas à avoir honte ici. Zéro jugement. 🤍",
    "Tu n'as pas à avoir honte. On est ensemble. 🌿",
  ],
  soulagé: [
    "Je suis content·e que tu aies pu en parler. C'est un beau pas. 🌿",
  ],
  inquiétude: [
    "Je sens que tu t'inquiètes. Dis-m'en plus, je t'écoute.",
  ],
};

/**
 * Sélectionne un adage aléatoire pertinent pour un domaine donné.
 * Retourne null si aucun adage pertinent ou si le contexte est grave (red flag).
 */
export function pickAdage(domain?: string): { text: string; context: string } | null {
  const relevant = domain
    ? AFRICAN_ADAGES.filter((a) => a.domain === domain)
    : AFRICAN_ADAGES;
  if (relevant.length === 0) return null;
  const pick = relevant[Math.floor(Math.random() * relevant.length)];
  return { text: pick.text, context: pick.context };
}

/**
 * Sélectionne une phrase de vulnérabilité selon le contexte.
 */
export function pickVulnerability(
  type: "notSure" | "touched" | "present" | "honest",
): string {
  const phrases = VULNERABILITY_PHRASES[type];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Sélectionne un humor léger pour un domaine NON grave.
 * Retourne null si le domaine n'est pas éligible à l'humour.
 */
export function pickHumor(domain: string): string | null {
  const safe = ["nutrition", "hygiene", "general"];
  if (!safe.includes(domain)) return null;
  const jokes = HUMOR_LIGHT[domain as keyof typeof HUMOR_LIGHT];
  if (!jokes) return null;
  return jokes[Math.floor(Math.random() * jokes.length)];
}

/**
 * Sélectionne un récit anonyme pour un domaine.
 * Retourne null si pas de récit pertinent.
 */
export function pickStory(domain: string): string | null {
  const key = domain === "SSR" ? "tpe" : domain.toLowerCase().includes("addict")
    ? "addiction"
    : domain.toLowerCase().includes("mental")
      ? "mental"
      : domain.toLowerCase().includes("dermato")
        ? "skin"
        : domain.toLowerCase().includes("nutrition")
          ? "nutrition"
          : "ist";
  const stories = ANONYMOUS_STORIES[key as keyof typeof ANONYMOUS_STORIES];
  if (!stories || stories.length === 0) return null;
  return stories[Math.floor(Math.random() * stories.length)];
}
