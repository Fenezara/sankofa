"use client";

/**
 * Sankofa — Tab Coach (V3 — perfectionné)
 *
 * - Progression : streak (🔥 X jours) + badge + barre de progression vers prochain badge
 * - Astuce du jour : bouton "En savoir plus →" qui appelle onAskQuestion
 * - Quiz du jour : 1 question / jour (déterministe via dayOfYear), 4 options,
 *   explication + score, 7 points hebdo (Lun→Dim), intégration streak si correct.
 * - Défi 7 jours : grille avec ✓ pour les jours complétés
 * - 5 domaines : cards avec image de fond + overlay sombre + texte blanc
 * - Sankofa vs Influenceurs : 2 colonnes visuelles (✅ vert / ❌ rouge)
 */

import * as React from "react";
import {
  Sprout,
  Heart,
  Brain,
  Pill,
  Apple,
  Check,
  X,
  Flame,
  Sparkles,
  ArrowRight,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { getStreak, getStreakBadge, updateStreak } from "@/lib/streaks";
import { cn } from "@/lib/utils";
import { TestimoniesSection } from "@/components/aya/testimonies-section";
import { CulturalBanner } from "@/components/aya/cultural-banner";
import { CulturalSection } from "@/components/aya/cultural-section";

interface CoachTabProps {
  onAskQuestion: (question: string) => void;
}

const TIPS = [
  {
    day: 0,
    domain: "SSR",
    text: "L'eau n'est pas une méthode contraceptive. Seuls les préservatifs et la pilule protègent.",
    emoji: "💧",
    followUp: "Dis-m'en plus sur les méthodes contraceptives disponibles en Côte d'Ivoire",
  },
  {
    day: 1,
    domain: "Addictologie",
    text: "Le tramadol pour étudier ? Ça détruit ta mémoire à long terme. Pas le boost que tu crois.",
    emoji: "💊",
    followUp: "Comment arrêter le tramadol sans trop souffrir ?",
  },
  {
    day: 2,
    domain: "Dermatologie",
    text: "Ta couleur de peau est parfaite. Les crèmes éclaircissantes causent cancer et diabète.",
    emoji: "🤎",
    followUp: "Quels sont les risques concrets des crèmes éclaircissantes ?",
  },
  {
    day: 3,
    domain: "Santé mentale",
    text: "Triste depuis +2 semaines ? Ce n'est pas 'être faible'. C'est un signal à écouter.",
    emoji: "🤍",
    followUp: "Comment savoir si je fais une dépression ?",
  },
  {
    day: 4,
    domain: "Nutrition",
    text: "Attiéké + poisson + légumes = le combo local le plus équilibré et pas cher.",
    emoji: "🐟",
    followUp: "Donne-moi un exemple de menu équilibré ivoirien pour la semaine",
  },
  {
    day: 5,
    domain: "SSR",
    text: "Le préservatif craqué ? TPE 72h. Pas de honte, juste de la rapidité.",
    emoji: "🕐",
    followUp: "Comment savoir si j'ai besoin du TPE 72h ?",
  },
  {
    day: 6,
    domain: "Général",
    text: "Boire 1.5L d'eau aujourd'hui. Ton corps et ta peau te diront merci.",
    emoji: "💦",
    followUp: "Pourquoi l'hydratation est si importante pour ma santé ?",
  },
];

const DOMAINS = [
  {
    name: "SSR",
    desc: "IST, contraception, TPE 72h",
    icon: Heart,
    color: "#D65430",
    question: "J'ai une question sur ma santé sexuelle",
    image: "/images/v3/temoignage-1.jpg",
  },
  {
    name: "Addictologie",
    desc: "Tramadol, alcool, tabac",
    icon: Pill,
    color: "#B84421",
    question: "Je veux arrêter une substance",
    image: "/images/v3/temoignage-2.jpg",
  },
  {
    name: "Dermatologie",
    desc: "Acné, dépigmentation, soins",
    icon: Sprout,
    color: "#F5A623",
    question: "J'ai un problème de peau",
    image: "/images/v3/comite-medical.jpg",
  },
  {
    name: "Santé mentale",
    desc: "Dépression, anxiété, stress",
    icon: Brain,
    color: "#5C3543", // mauve-crepuscule — calme, introspectif (palette Sankofa, teinte de la peau Aya)
    question: "Je me sens mal psychologiquement",
    image: "/images/v3/temoignage-3.jpg",
  },
  {
    name: "Nutrition",
    desc: "Alimentation, compléments",
    icon: Apple,
    color: "#2D4A2D", // vert-baobab — croissance, nature (palette Sankofa, wax forest green d'Aya)
    question: "J'ai une question sur la nutrition",
    image: "/images/v3/marche-ci.jpg",
  },
];

const COMPARISON = [
  { critere: "Validation", sankofa: "Médecins ivoiriens", influenceurs: "Aucune formation" },
  { critere: "Sources", sankofa: "Protocoles OMS", influenceurs: "Recettes maison" },
  { critere: "Anonymat", sankofa: "100% anonyme", influenceurs: "Public, jugements" },
  { critere: "Disponibilité", sankofa: "24/7", influenceurs: "Aléatoire" },
  { critere: "Coût", sankofa: "Gratuit (info vitale)", influenceurs: "Souvent payant" },
];

// Badges progression : 1, 3, 7, 14, 30, 100 jours
const BADGE_TIERS = [
  { threshold: 1, label: "Premier pas", emoji: "🌱" },
  { threshold: 3, label: "Motivé·e", emoji: "💪" },
  { threshold: 7, label: "Régulier·ère", emoji: "🔥" },
  { threshold: 14, label: "Constant·e", emoji: "⭐" },
  { threshold: 30, label: "Confiant·e", emoji: "🌟" },
  { threshold: 100, label: "Sage", emoji: "🦉" },
];

// === QUIZ DU JOUR ===

type QuizDomain = "SSR" | "Addictologie" | "Dermatologie" | "Santé mentale" | "Nutrition";

interface QuizQuestion {
  id: string;
  domain: QuizDomain;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_DOMAIN_COLORS: Record<QuizDomain, string> = {
  SSR: "#D65430",
  Addictologie: "#B84421",
  Dermatologie: "#F5A623",
  "Santé mentale": "#5C3543",
  Nutrition: "#2D4A2D",
};

const QUIZ_QUESTIONS: QuizQuestion[] = [
  // SSR
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
    id: "q7",
    domain: "SSR",
    question: "Quelle méthode protège à la fois des IST et des grossesses ?",
    options: ["La pilule", "Le préservatif", "Le retrait", "La douche après le rapport"],
    correctIndex: 1,
    explanation: "Seul le préservatif (masculin ou féminin) protège à la fois des IST et des grossesses non désirées.",
  },
  {
    id: "q8",
    domain: "SSR",
    question: "Une IST peut-elle être asymptomatique ?",
    options: ["Non, toujours des symptômes", "Oui, surtout chez les filles", "Seulement le VIH", "Seulement la syphilis"],
    correctIndex: 1,
    explanation: "La plupart des IST sont silencieuses chez la fille (chlamydia, gonorrhée). D'où l'importance du dépistage régulier.",
  },
  {
    id: "q9",
    domain: "SSR",
    question: "Le VIH se transmet par :",
    options: ["La salive", "Les moustiques", "Le sang, sperme, sécrétions vaginales", "Les toilettes publiques"],
    correctIndex: 2,
    explanation: "Le VIH se transmet par le sang, le sperme, les sécrétions vaginales et le lait maternel. Jamais par salive ni moustiques.",
  },
  // Addictologie
  {
    id: "q3",
    domain: "Addictologie",
    question: "Le tramadol est :",
    options: ["Un antibiotique", "Un opioïde qui crée dépendance", "Un vitamine", "Un anti-inflammatoire"],
    correctIndex: 1,
    explanation: "Le tramadol est un opioïde. La dépendance peut survenir en 2-4 semaines.",
  },
  {
    id: "q10",
    domain: "Addictologie",
    question: "Le sevrage alcoolique sévère peut causer :",
    options: ["Rien de grave", "Des convulsions (crises d'épilepsie)", "Juste de la fatigue", "Un rhume"],
    correctIndex: 1,
    explanation: "Le sevrage alcoolique brutal peut causer convulsions et delirium tremens. À faire accompagner médicalement.",
  },
  {
    id: "q11",
    domain: "Addictologie",
    question: "Le tabac chauffé (IQOS, Glo) est :",
    options: ["Sans danger", "Moins toxique que la cigarette mais pas inoffensif", "Plus toxique que la cigarette", "Recommandé pour arrêter"],
    correctIndex: 1,
    explanation: "Le tabac chauffé expose à moins de toxines que la cigarette classique, mais reste addictif et nocif.",
  },
  {
    id: "q12",
    domain: "Addictologie",
    question: "Boire de l'alcool en étant mineur·e :",
    options: ["C'est bon pour le cœur", "Ça endommage le cerveau en développement", "Ça améliore la mémoire", "Aucun effet"],
    correctIndex: 1,
    explanation: "Avant 25 ans, le cerveau est en construction. L'alcool altère mémoire, apprentissage et humeur.",
  },
  {
    id: "q13",
    domain: "Addictologie",
    question: "La dépendance à la nicotine peut apparaître en :",
    options: ["Plusieurs années", "Quelques semaines seulement", "Jamais avant 18 ans", "Au moins 10 ans"],
    correctIndex: 1,
    explanation: "La dépendance à la nicotine peut s'installer en quelques semaines, même chez l'adolescent·e.",
  },
  // Dermatologie
  {
    id: "q4",
    domain: "Dermatologie",
    question: "Les crèmes éclaircissantes en Côte d'Ivoire :",
    options: ["Sont recommandées", "Sont interdites par la loi (2015)", "Sont inoffensives", "Sont des médicaments"],
    correctIndex: 1,
    explanation: "Loi 2015 : interdiction des produits dépigmentants. Dangers : hydroquinone, cancer de la peau.",
  },
  {
    id: "q14",
    domain: "Dermatologie",
    question: "L'acné à l'adolescence est principalement causée par :",
    options: ["Le chocolat", "Les hormones", "Le soleil", "Le savon"],
    correctIndex: 1,
    explanation: "Les fluctuations hormonales à la puberté stimulent les glandes sébacées. Pas le chocolat !",
  },
  {
    id: "q15",
    domain: "Dermatologie",
    question: "Pour nettoyer une peau à acné, il faut :",
    options: ["Frotter fort avec du savon", "Nettoyer doucement 2x/jour", "Ne rien faire", "Utiliser de l'eau de javel"],
    correctIndex: 1,
    explanation: "Un nettoyage doux matin + soir avec un produit doux suffit. Frotter aggrave l'inflammation.",
  },
  {
    id: "q16",
    domain: "Dermatologie",
    question: "La dépigmentation peut causer :",
    options: ["Rien de grave", "Diabète, hypertension, cancer de la peau", "Un bronzage durable", "Une peau plus jeune"],
    correctIndex: 1,
    explanation: "Les produits dépigmentants (hydroquinone, corticoïdes) causent diabète, hypertension, infections, cancer.",
  },
  {
    id: "q17",
    domain: "Dermatologie",
    question: "Le soleil sur ta peau, c'est :",
    options: ["Toujours bon", "Utile en petite dose (vitamine D) mais dangereux en excès", "Toujours mauvais", "Sans effet"],
    correctIndex: 1,
    explanation: "15-20 min/jour suffisent pour la vitamine D. Au-delà sans protection : vieillissement, cancer de la peau.",
  },
  // Santé mentale
  {
    id: "q5",
    domain: "Santé mentale",
    question: "Si tu te sens triste tout le temps depuis 2 semaines, tu devrais :",
    options: ["Attendre que ça passe", "En parler à un·e pro·fessionnel·le", "Prendre des compléments", "Boire de l'alcool"],
    correctIndex: 1,
    explanation: "Tristesse persistante +2 semaines = possible dépression. Parler à un pro = première étape.",
  },
  {
    id: "q18",
    domain: "Santé mentale",
    question: "Une attaque de panique dure généralement :",
    options: ["Plusieurs jours", "10 à 30 minutes", "Toute la nuit", "Quelques secondes"],
    correctIndex: 1,
    explanation: "Une attaque de panique dure 10-30 min en moyenne. Le pic est vers 10 min, puis ça descend. Ça passe toujours.",
  },
  {
    id: "q19",
    domain: "Santé mentale",
    question: "Le sommeil influence :",
    options: ["Rien", "Humeur, mémoire, immunité, poids", "Seulement la fatigue", "Uniquement les rêves"],
    correctIndex: 1,
    explanation: "Le sommeil < 7h altère humeur, mémoire, immunité et régulation du poids. Fondamental à ton âge.",
  },
  {
    id: "q20",
    domain: "Santé mentale",
    question: "Penser à la mort régulièrement, c'est :",
    options: ["Normal à 16 ans", "Un signal à prendre au sérieux, à dire à un·e adulte", "Une preuve de maturité", "Honteux"],
    correctIndex: 1,
    explanation: "Les idées noires répétées = signal d'alerte. En parler à un·e adulte de confiance ou un professionnel = vital.",
  },
  {
    id: "q21",
    domain: "Santé mentale",
    question: "Pour gérer le stress avant un examen :",
    options: ["Prendre du tramadol", "Dormir moins pour réviser plus", "Respirer, bouger, dormir 7h+", "Boire du café toute la nuit"],
    correctIndex: 2,
    explanation: "La respiration profonde, l'activité physique et le sommeil sont les meilleurs alliés cognitifs. Le café en excès = anxiété.",
  },
  // Nutrition
  {
    id: "q6",
    domain: "Nutrition",
    question: "Combien de fruits et légumes par jour recommande l'OMS ?",
    options: ["1 portion", "3 portions", "5 portions (400g)", "10 portions"],
    correctIndex: 2,
    explanation: "OMS recommande 5 portions (400g) de fruits/légumes par jour pour réduire les maladies cardio.",
  },
  {
    id: "q22",
    domain: "Nutrition",
    question: "Le petit-déjeuner sauté le matin :",
    options: ["Aucun impact", "Baisse la concentration et l'humeur", "Fait maigrir", "Augmente la mémoire"],
    correctIndex: 1,
    explanation: "Sauter le petit-déjeuner altère la concentration, la mémoire et l'humeur jusqu'au midi. Surtout chez l'ado.",
  },
  {
    id: "q23",
    domain: "Nutrition",
    question: "Boire 1.5L d'eau par jour aide à :",
    options: ["Rien", "Peau, digestion, énergie, concentration", "Prendre du poids", "Mieux dormir"],
    correctIndex: 1,
    explanation: "Une bonne hydratation améliore peau, digestion, énergie et clarté mentale. 1.5-2L/jour à ton âge.",
  },
  {
    id: "q24",
    domain: "Nutrition",
    question: "Les boissons sucrées (sodas, jus industriels) :",
    options: ["Comptent comme des fruits", "Augmentent le risque de diabète et obésité", "Donnent de l'énergie saine", "Sont recommandées"],
    correctIndex: 1,
    explanation: "Une canette de soda = ~7 morceaux de sucre. À long terme : diabète, obésité, caries. L'eau = meilleur choix.",
  },
  {
    id: "q25",
    domain: "Nutrition",
    question: "Une bonne assiette ivoirienne équilibrée contient :",
    options: ["Rien que du riz", "Légumes + protéines + féculents", "Que de la viande", "Que du sucre"],
    correctIndex: 1,
    explanation: "Idéalement : 1/2 légumes, 1/4 protéines (poisson, poulet, œuf), 1/4 féculents (riz, attiéké, igname).",
  },
];

/**
 * Retourne le jour de l'année (1-366) basé sur la date locale.
 */
function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff =
    d.getTime() -
    start.getTime() +
    (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000;
  return Math.floor(diff / 86400000);
}

/**
 * Retourne l'identifiant de semaine ISO (YYYY-WW) basé sur la date locale.
 */
function getISOWeekId(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekDiff = (date.getTime() - firstThursday.getTime()) / 86400000;
  const weekNum = 1 + Math.round(weekDiff / 7);
  return `${date.getUTCFullYear()}-${String(weekNum).padStart(2, "0")}`;
}

/**
 * Retourne YYYY-MM-DD (date locale) — clé de persistance quotidienne du quiz.
 */
function getTodayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Index du jour dans la semaine (Lundi=0, Dimanche=6) — utile pour les 7 points hebdo.
 */
function getDayIndexMonFirst(d: Date): number {
  return (d.getDay() + 6) % 7;
}

interface DailyQuizProps {
  /**
   * Appelé après une réponse correcte (si le streak a été incrémenté ou non),
   * pour rafraîchir la section Progression du parent.
   */
  onStreakChange?: (newStreak: number) => void;
  /** Permet de poser une question à Aya suite à l'explication du quiz. */
  onAskQuestion?: (question: string) => void;
}

function DailyQuiz({ onStreakChange, onAskQuestion }: DailyQuizProps) {
  // Question du jour — déterministe via dayOfYear % nb questions.
  // Initialisé à 0 (hydration-safe), mis à jour dans useEffect.
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [answered, setAnswered] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [streakIncremented, setStreakIncremented] = React.useState(false);
  const [weekProgress, setWeekProgress] = React.useState<boolean[]>(
    Array(7).fill(false),
  );

  // Clés localStorage dérivées (calculées dans useMemo pour rester stables).
  const todayKey = React.useMemo(() => `sankofa:quiz-${getTodayStr(new Date())}`, []);
  const weekKey = React.useMemo(() => `sankofa:quiz-week-${getISOWeekId(new Date())}`, []);

  React.useEffect(() => {
    // Calcule l'index de la question du jour (côté client uniquement).
    const today = new Date();
    setQuestionIndex(getDayOfYear(today) % QUIZ_QUESTIONS.length);

    try {
      // Restore la réponse du jour si déjà joué.
      const raw = localStorage.getItem(todayKey);
      if (raw) {
        const data = JSON.parse(raw);
        if (
          data &&
          typeof data.selectedIndex === "number" &&
          typeof data.correct === "boolean"
        ) {
          setAnswered(true);
          setSelectedIndex(data.selectedIndex);
        }
      }

      // Restore la progression hebdo (7 jours Lun→Dim).
      const weekRaw = localStorage.getItem(weekKey);
      if (weekRaw) {
        const arr = JSON.parse(weekRaw);
        if (Array.isArray(arr) && arr.length === 7) {
          setWeekProgress(arr.map(Boolean));
        }
      }
    } catch {
      // Silencieux : localStorage peut être indisponible (mode privé, etc.).
    }
  }, [todayKey, weekKey]);

  const question = QUIZ_QUESTIONS[questionIndex];
  const domainColor = QUIZ_DOMAIN_COLORS[question.domain];
  const isCorrectAnswer =
    selectedIndex !== null && selectedIndex === question.correctIndex;

  const handleAnswer = (idx: number) => {
    if (answered) return;

    const correct = idx === question.correctIndex;
    setSelectedIndex(idx);
    setAnswered(true);

    try {
      // Persiste la réponse du jour.
      localStorage.setItem(
        todayKey,
        JSON.stringify({
          questionId: question.id,
          selectedIndex: idx,
          correct,
        }),
      );

      // Marque le jour dans la semaine (Lun=0 ... Dim=6).
      const dayIdx = getDayIndexMonFirst(new Date());
      const updated = [...weekProgress];
      updated[dayIdx] = true;
      setWeekProgress(updated);
      localStorage.setItem(weekKey, JSON.stringify(updated));
    } catch {
      // Silencieux.
    }

    if (correct) {
      // Intégration streak : updateStreak() n'incrémente qu'une fois par jour.
      const beforeStreak = getStreak().current;
      const updatedStreak = updateStreak().current;
      onStreakChange?.(updatedStreak);

      if (updatedStreak > beforeStreak) {
        setStreakIncremented(true);
        toast.success("Bonne réponse ! +1 jour 🔥");
      } else {
        // Le streak était déjà compté aujourd'hui (visite précédente).
        toast.success("Bonne réponse ! 🔥");
      }
    } else {
      toast.error("Pas tout à fait — regarde l'explication");
    }
  };

  const weekDayLabels = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="sankofa-card rounded-2xl p-4">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-ocre-rouge" aria-hidden="true" />
          <h3
            className="text-sm font-bold text-terre-brulee"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Quiz du jour
          </h3>
        </div>
        {streakIncremented && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full">
            <Flame className="size-3" aria-hidden="true" /> +1 jour
          </span>
        )}
      </div>

      {/* Badge domaine + points hebdo */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <span
          className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{
            backgroundColor: `${domainColor}1A`,
            color: domainColor,
            border: `1px solid ${domainColor}40`,
          }}
        >
          {question.domain}
        </span>

        <div className="flex items-center gap-1.5" aria-label="Progression des quiz cette semaine">
          {weekDayLabels.map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={cn(
                  "size-2 rounded-full transition-colors",
                  weekProgress[i] ? "bg-vert-baobab" : "bg-ocre-rouge/15",
                )}
                title={
                  weekProgress[i]
                    ? `Jour ${i + 1} — quiz complété`
                    : `Jour ${i + 1} — pas encore`
                }
              />
              <span className="text-[8px] text-ocre-rouge/50 font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Question */}
      <p className="text-sm text-terre-brulee leading-relaxed mb-3">{question.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((opt, idx) => {
          const isCorrect = idx === question.correctIndex;
          const isSelected = idx === selectedIndex;

          const base =
            "text-left p-3 rounded-lg border w-full transition-colors disabled:cursor-default";
          const state = answered
            ? isCorrect
              ? "bg-vert-baobab/15 border-vert-baobab/40 text-vert-baobab"
              : isSelected
                ? "bg-terracotta/15 border-terracotta/40 text-terracotta"
                : "border-ocre-rouge/15 opacity-60"
            : "border-ocre-rouge/15 hover:bg-ocre-rouge/5";

          return (
            <button
              key={idx}
              type="button"
              disabled={answered}
              onClick={() => handleAnswer(idx)}
              className={cn(base, state)}
              aria-pressed={isSelected}
            >
              <span className="flex items-center gap-2">
                <span
                  className="shrink-0 size-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold"
                  aria-hidden="true"
                >
                  {answered && isCorrect ? (
                    <Check className="size-3" />
                  ) : answered && isSelected ? (
                    <X className="size-3" />
                  ) : (
                    String.fromCharCode(65 + idx)
                  )}
                </span>
                <span className="flex-1 text-sm leading-snug">{opt}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Explication + score (uniquement après réponse) */}
      {answered && (
        <div className="mt-3 bg-ambre-couchant/10 border-l-4 border-ambre-couchant rounded-r-lg p-3 text-sm">
          <p className="text-xs font-semibold text-ocre-rouge mb-1">
            {isCorrectAnswer ? "✓ Bonne réponse !" : "Pas tout à fait..."}
          </p>
          <p className="text-xs text-terre-brulee/80 leading-relaxed">
            {question.explanation}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-ocre-rouge/70">
              Score du jour : {isCorrectAnswer ? "1/1" : "0/1"}
            </span>
            <div className="flex items-center gap-2">
              {onAskQuestion && (
                <button
                  type="button"
                  onClick={() =>
                    onAskQuestion(
                      `Peux-tu m'en dire plus sur : ${question.question}`,
                    )
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:text-ocre-rouge transition-colors"
                >
                  En savoir plus
                  <ArrowRight className="size-3" aria-hidden="true" />
                </button>
              )}
              <span className="text-[10px] text-ocre-rouge/50 font-medium">
                Quiz terminé !
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function CoachTab({ onAskQuestion }: CoachTabProps) {
  const [tipIndex, setTipIndex] = React.useState(0);
  const [challengeAccepted, setChallengeAccepted] = React.useState(false);
  const [streak, setStreak] = React.useState(0);
  const [challengeDaysDone, setChallengeDaysDone] = React.useState(1);

  React.useEffect(() => {
    const day = new Date().getDay();
    setTipIndex(day);
    try {
      setChallengeAccepted(localStorage.getItem("sankofa:challenge") === "accepted");
      const savedDays = localStorage.getItem("sankofa:challenge-days");
      if (savedDays) setChallengeDaysDone(Math.min(7, Math.max(1, parseInt(savedDays, 10) || 1)));
      setStreak(getStreak().current);
    } catch {}
  }, []);

  const acceptChallenge = () => {
    setChallengeAccepted(true);
    setChallengeDaysDone(1);
    try {
      localStorage.setItem("sankofa:challenge", "accepted");
      localStorage.setItem("sankofa:challenge-days", "1");
    } catch {}
  };

  const tip = TIPS[tipIndex];

  // Progression vers le prochain badge
  const currentBadge = getStreakBadge(streak);
  const nextTier = BADGE_TIERS.find((t) => t.threshold > streak) ?? BADGE_TIERS[BADGE_TIERS.length - 1];
  const prevTierThreshold = [...BADGE_TIERS].reverse().find((t) => t.threshold <= streak)?.threshold ?? 0;
  const progressPct =
    nextTier.threshold === prevTierThreshold
      ? 100
      : Math.min(
          100,
          Math.round(((streak - prevTierThreshold) / (nextTier.threshold - prevTierThreshold)) * 100),
        );

  return (
    <div className="flex flex-col">
      {/* En-tête simple — style app */}
      <div className="bg-warm-aura px-4 py-3 border-b border-ocre-rouge/10 shrink-0">
        <h1
          className="text-xl font-bold text-terre-brulee"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Coach
        </h1>
        <p className="text-xs text-ocre-rouge/60 mt-0.5">Ton coach santé validé</p>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 min-h-0 px-4 py-4 space-y-4">
        {/* === Section Progression === */}
        <div className="bg-gradient-to-br from-or-poudre-clair/20 via-creme-baobab to-creme-baobab rounded-2xl border border-or-poudre-clair/30 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-ambre-couchant" />
              <h3 className="text-sm font-bold text-terre-brulee" style={{ fontFamily: "var(--font-bricolage)" }}>
                Progression
              </h3>
            </div>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm ${streak > 0 ? "glow-pulse" : ""}`}
              style={{
                background: "linear-gradient(135deg, #F4C77B 0%, #E89B3C 100%)",
                borderColor: "rgba(123, 70, 19, 0.4)",
              }}
            >
              <Flame className="size-3.5 text-ocre-rouge" />
              <span className="text-xs font-bold text-ocre-rouge">{streak}j</span>
            </div>
          </div>

          {/* Badge actuel */}
          <div className="flex items-center gap-3 mb-3">
            <div className="size-11 rounded-xl bg-creme-baobab border border-or-poudre-clair/40 flex items-center justify-center text-xl shadow-sm shrink-0">
              <span aria-hidden="true">{currentBadge.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-terre-brulee">{currentBadge.label}</p>
              <p className="text-[11px] text-ocre-rouge/70">
                {streak === 0
                  ? "Reviens demain pour démarrer ton streak"
                  : `Prochain badge dans ${Math.max(0, nextTier.threshold - streak)}j`}
              </p>
            </div>
            <Trophy className="size-4 text-ambre-couchant/70 shrink-0" aria-hidden="true" />
          </div>

          {/* Barre de progression */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-ocre-rouge/70 font-semibold">
              <span>Niveau {currentBadge.label}</span>
              <span>{nextTier.label} · {nextTier.threshold}j</span>
            </div>
            <div className="h-2 rounded-full bg-ocre-rouge/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #E89B3C 0%, #D65430 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* === Astuce du jour === */}
        <div className="sankofa-card rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 size-10 rounded-xl bg-terracotta/15 flex items-center justify-center text-xl">
              {tip.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="size-3.5 text-terracotta" />
                <p className="text-[10px] uppercase tracking-widest text-ocre-rouge/70 font-semibold">
                  Astuce du jour · {tip.domain}
                </p>
              </div>
              <p className="text-sm text-terre-brulee leading-relaxed">{tip.text}</p>
              <button
                type="button"
                onClick={() => onAskQuestion(tip.followUp)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-terracotta hover:text-ocre-rouge transition-colors"
              >
                En savoir plus
                <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        </div>

        {/* === Quiz du jour === */}
        <DailyQuiz
          onStreakChange={(newStreak) => setStreak(newStreak)}
          onAskQuestion={onAskQuestion}
        />

        {/* === Défi de la semaine === */}
        <div className="sankofa-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-terracotta" />
              <h3 className="text-sm font-bold text-terre-brulee">Défi de la semaine</h3>
            </div>
            {challengeAccepted && (
              <span className="flex items-center gap-1 text-[11px] text-vert-baobab font-semibold bg-vert-baobab/10 px-2 py-0.5 rounded-full">
                <Check className="size-3" /> {challengeDaysDone}/7
              </span>
            )}
          </div>
          <p className="text-sm text-terre-brulee/80 mb-3">
            Marche 20 minutes par jour. Ton corps et ton mental te remercieront.
          </p>
          {!challengeAccepted ? (
            <button
              onClick={acceptChallenge}
              className="btn-premium noise-texture press w-full px-4 py-2.5 rounded-xl text-creme-baobab text-sm font-bold overflow-hidden"
            >
              Accepter le défi
            </button>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => {
                const done = i < challengeDaysDone;
                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                      done
                        ? "bg-vert-baobab/20 border-vert-baobab/50"
                        : "bg-ocre-rouge/5 border-ocre-rouge/15"
                    }`}
                    title={`Jour ${i + 1}${done ? " — complété" : ""}`}
                  >
                    {done ? (
                      <Check className="size-3.5 text-vert-baobab" />
                    ) : (
                      <span className="text-[9px] font-semibold text-ocre-rouge/50">J{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* === 5 domaines === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            5 domaines, 1 coach
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {DOMAINS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.name}
                  onClick={() => onAskQuestion(d.question)}
                  className="press sankofa-card-pressable relative overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-shadow text-left h-32 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-creme-baobab"
                >
                  {/* Image de fond — avec gestion d'erreur + fallback gradient */}
                  <img
                    src={d.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      // Masque l'image cassée — le fallback gradient reste visible
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Fallback gradient (visible si l'image ne charge pas) */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${d.color} 0%, ${d.color}99 100%)`,
                    }}
                    aria-hidden="true"
                  />
                  {/* Overlay sombre */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(40, 18, 8, 0.45) 0%, rgba(40, 18, 8, 0.78) 100%)",
                    }}
                  />
                  {/* Contenu texte blanc */}
                  <div className="relative h-full flex flex-col justify-between p-3.5 text-creme-baobab">
                    <div
                      className="size-9 rounded-lg flex items-center justify-center backdrop-blur-sm"
                      style={{ backgroundColor: `${d.color}40`, border: `1px solid ${d.color}80` }}
                    >
                      <Icon className="size-5" style={{ color: "#FBF3E4" }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold truncate"
                        style={{ fontFamily: "var(--font-bricolage)" }}
                      >
                        {d.name}
                      </p>
                      <p className="text-[11px] text-creme-baobab/80 truncate">{d.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* === Sankofa vs Influenceurs — 2 colonnes visuelles === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Sankofa vs Influenceurs
          </h3>
          <div className="sankofa-card rounded-2xl p-4">
            <p className="text-xs text-ocre-rouge/80 mb-3 italic">
              90% des conseils d'influenceurs sont faux. Sankofa, 100% validés.
            </p>
            {/* En-têtes colonnes */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-vert-baobab/12 border border-vert-baobab/25">
                <span className="text-vert-baobab text-sm">✅</span>
                <span className="text-[11px] font-bold text-vert-baobab">Sankofa</span>
              </div>
              <div className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-ocre-rouge/8 border border-ocre-rouge/20">
                <span className="text-ocre-rouge/60 text-sm">❌</span>
                <span className="text-[11px] font-bold text-ocre-rouge/70">Influenceurs</span>
              </div>
            </div>
            {/* Lignes de comparaison */}
            <div className="space-y-1.5">
              {COMPARISON.map((row) => (
                <div key={row.critere} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-stretch">
                  <div className="flex items-center">
                    <span className="text-[11px] font-semibold text-terre-brulee leading-tight">
                      {row.critere}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-vert-baobab/8">
                    <Check className="size-3 text-vert-baobab shrink-0 mt-px" />
                    <span className="text-[11px] text-terre-brulee/85 leading-tight min-w-0">
                      {row.sankofa}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-ocre-rouge/5">
                    <span className="size-3 text-ocre-rouge/50 shrink-0 mt-px text-center leading-none font-bold">
                      ✕
                    </span>
                    <span className="text-[11px] text-ocre-rouge/60 leading-tight min-w-0">
                      {row.influenceurs}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* === Bannière culturelle (événement du jour : Ramadan, examens, etc.) === */}
        <CulturalBanner />

        {/* === Section culturelle (plantes, Adinkra, expressions) === */}
        <CulturalSection />

        {/* === Témoignages anonymes modérés (Pair-Aidant Lite) === */}
        <TestimoniesSection />
      </div>
    </div>
  );
}

export default CoachTab;
