/**
 * GET /api/quiz/today
 *
 * Retourne la question du jour (sélection déterministe par jour de l'année).
 * Même question pour tous les utilisateurs le même jour.
 *
 * Query: ?offset=N — décalage de jours (pour tests/rattrapage)
 *
 * Response: {
 *   question: {
 *     id, domain, question, options (4), correctIndex, explanation
 *   },
 *   dayOfYear, date (YYYY-MM-DD)
 * }
 *
 * IMPORTANT : n'envoie PAS correctIndex ni explanation côté client
 * tant que l'utilisateur n'a pas répondu. On les envoie seulement
 * si ?answered=true est passé (le client confirme avoir répondu).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface QuizQuestion {
  id: string;
  domain: "SSR" | "Addictologie" | "Dermatologie" | "Santé mentale" | "Nutrition";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    domain: "SSR",
    question: "Le TPE (Traitement Post-Exposition) est efficace dans combien de temps ?",
    options: ["24h maximum", "72h maximum", "1 semaine", "1 mois"],
    correctIndex: 1,
    explanation: "Le TPE doit être pris dans les 72h après un rapport à risque. Plus tôt = plus efficace.",
  },
  {
    id: "q2",
    domain: "SSR",
    question: "La pilule du lendemain est efficace à :",
    options: ["100%", "85-95% si prise dans 24h", "50% maximum", "Seulement avant l'ovulation"],
    correctIndex: 1,
    explanation: "La pilule du lendemain a 85-95% d'efficacité si prise dans les 24h. Diminue après.",
  },
  {
    id: "q3",
    domain: "Addictologie",
    question: "Le tramadol est :",
    options: ["Un antibiotique", "Un opioïde qui crée dépendance", "Une vitamine", "Un anti-inflammatoire"],
    correctIndex: 1,
    explanation: "Le tramadol est un opioïde. La dépendance peut survenir en 2-4 semaines.",
  },
  {
    id: "q4",
    domain: "Dermatologie",
    question: "Les crèmes éclaircissantes en Côte d'Ivoire :",
    options: ["Sont recommandées", "Sont interdites par la loi (2015)", "Sont inoffensives", "Sont des médicaments"],
    correctIndex: 1,
    explanation: "Loi 2015 : interdiction des produits dépigmentants. Dangers : hydroquinone, cancer de la peau.",
  },
  {
    id: "q5",
    domain: "Santé mentale",
    question: "Si tu te sens triste tout le temps depuis 2 semaines, tu devrais :",
    options: ["Attendre que ça passe", "En parler à un·e professionnel·le", "Prendre des compléments", "Boire de l'alcool"],
    correctIndex: 1,
    explanation: "Tristesse persistante +2 semaines = possible dépression. Parler à un pro = première étape.",
  },
  {
    id: "q6",
    domain: "Nutrition",
    question: "Combien de fruits et légumes par jour recommande l'OMS ?",
    options: ["1 portion", "3 portions", "5 portions (400g)", "10 portions"],
    correctIndex: 2,
    explanation: "OMS recommande 5 portions (400g) de fruits/légumes par jour pour réduire les maladies cardio.",
  },
  {
    id: "q7",
    domain: "SSR",
    question: "Le préservatif protège contre :",
    options: ["Uniquement le VIH", "Toutes les IST", "Uniquement la grossesse", "Aucune IST"],
    correctIndex: 1,
    explanation: "Le préservatif est la SEULE méthode qui protège contre TOUTES les IST + grossesse.",
  },
  {
    id: "q8",
    domain: "Addictologie",
    question: "Le sevrage d'alcool doit être :",
    options: ["Brutal et seul", "Encadré médicalement", "Rapide (48h)", "Impossible"],
    correctIndex: 1,
    explanation: "Le sevrage alcoolique non encadré peut être mortel (convulsions, delirium tremens).",
  },
  {
    id: "q9",
    domain: "Dermatologie",
    question: "L'acné est souvent liée à :",
    options: ["Un manque d'hygiène", "Des hormones", "La malédiction", "Le soleil"],
    correctIndex: 1,
    explanation: "L'acné est principalement hormonale (puberté, cycles). Pas liée à un manque d'hygiène.",
  },
  {
    id: "q10",
    domain: "Santé mentale",
    question: "Le numéro vert d'écoute psychologique en CI est :",
    options: ["185", "143", "110", "15"],
    correctIndex: 1,
    explanation: "143 = Numéro vert d'écoute psychologique 24h/24 en Côte d'Ivoire. Gratuit et anonyme.",
  },
  {
    id: "q11",
    domain: "Nutrition",
    question: "Le petit-déjeuner devrait représenter :",
    options: ["5% de la journée", "25% des calories du jour", "Rien", "10%"],
    correctIndex: 1,
    explanation: "Le petit-déjeuner = 25% des calories du jour. Sauter le petit-déj = fatigue + grignotage.",
  },
  {
    id: "q12",
    domain: "SSR",
    question: "Après un rapport à risque, le test VIH est fiable à :",
    options: ["Immédiatement", "4 semaines (test 4e génération)", "1 an", "Jamais"],
    correctIndex: 1,
    explanation: "Test VIH 4e génération fiable à 4 semaines. Test rapide = 3 mois pour fiabilité 100%.",
  },
  {
    id: "q13",
    domain: "Addictologie",
    question: "La nicotine crée une dépendance en :",
    options: ["Jamais", "Quelques jours à semaines", "10 ans", "Seulement si adulte"],
    correctIndex: 1,
    explanation: "La nicotine peut créer une dépendance en quelques jours à semaines, surtout chez les jeunes.",
  },
  {
    id: "q14",
    domain: "Dermatologie",
    question: "L'hydroquinone dans les crèmes éclaircissantes :",
    options: ["Hydrate la peau", "Provoque cancer + ochronose", "Est un vitamine", "Est inoffensive"],
    correctIndex: 1,
    explanation: "Hydroquinone : cancer de la peau + ochronose (taches noires). Interdite en CI depuis 2015.",
  },
  {
    id: "q15",
    domain: "Santé mentale",
    question: "Une attaque de panique dure généralement :",
    options: ["Plusieurs jours", "10-30 minutes", "Quelques secondes", "1 heure+"],
    correctIndex: 1,
    explanation: "Crise d'angoisse = pic à 10 min, dure 10-30 min. Sensation de mourir = fréquente mais pas dangereuse.",
  },
];

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const offsetParam = url.searchParams.get("offset");
  const offset = offsetParam ? parseInt(offsetParam, 10) || 0 : 0;
  const answered = url.searchParams.get("answered") === "true";

  const now = new Date();
  now.setDate(now.getDate() + offset);
  const dayOfYear = getDayOfYear(now);
  const questionIndex = ((dayOfYear % QUIZ_QUESTIONS.length) + QUIZ_QUESTIONS.length) % QUIZ_QUESTIONS.length;
  const question = QUIZ_QUESTIONS[questionIndex];

  const dateStr = now.toISOString().slice(0, 10);

  // Si pas répondu, on masque correctIndex + explanation
  const safeQuestion = answered
    ? question
    : {
        id: question.id,
        domain: question.domain,
        question: question.question,
        options: question.options,
        // Pas de correctIndex ni explanation
      };

  return NextResponse.json({
    question: safeQuestion,
    dayOfYear,
    date: dateStr,
    answered,
  });
}
