"use client";

/**
 * Sankofa — Chat (V2)
 *
 * - 3 personas (grande_soeur par défaut, grand_frere, tonton_medecin)
 * - Bulles WhatsApp-style avec palette Sankofa (terracotta assistant, rose-couchée user)
 * - Suggestions en forme de cauris
 * - Avatar Aya = symbole Adinkra Aya (SVG)
 * - Welcome message ts=0 (sentinel) pour éviter hydration mismatch
 * - Personas envoyés au backend ; registre adaptatif géré côté serveur
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ShieldCheck, Stethoscope, AlertTriangle, Lock, Mic, Square, Volume2, ThumbsUp, ThumbsDown, Info, X } from "lucide-react";
import { toast } from "sonner";
import { playSendSound, playReceiveSound } from "@/lib/sounds";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CaurisChip } from "@/components/cultural/cauris-chip";
import { SankofaLogo } from "@/components/aya/sankofa-logo";
import { LoginButton } from "@/components/auth/login-button";
import { useSession } from "@/components/auth/auth-provider";
import type { Persona, RedFlagTopic } from "@/lib/guardrails";
import {
  COMPANION_CHECK_IN_INTERVAL_MS,
  COMPANION_MAX_CHECK_INS,
  COMPANION_RESUME_MESSAGE,
  COMPANION_AUTO_CANCEL_MESSAGE,
  INITIAL_COMPANION_STATE,
  loadCompanionState,
  saveCompanionState,
  getCheckInMessage,
  getQuickActionResponse,
  getTriggerLabel,
  type CompanionState,
  type CompanionQuickAction,
} from "@/lib/companion";
import {
  CompanionBanner,
  CompanionQuickActions,
} from "@/components/aya/companion-banner";

/** Photo portrait par persona (répertoire /public/images/v3/). */
const PERSONA_PHOTO: Record<Persona, string> = {
  grande_soeur: "/images/v3/persona-aya.jpg",
  grand_frere: "/images/v3/persona-yao.jpg",
  tonton_medecin: "/images/v3/persona-tonton.jpg",
};

/** Alt texte par persona. */
const PERSONA_ALT: Record<Persona, string> = {
  grande_soeur: "Portrait d'Aya, jeune femme ivoirienne, grande sœur bienveillante",
  grand_frere: "Portrait de Yao, jeune homme ivoirien, grand frère protecteur",
  tonton_medecin: "Portrait de Tonton Koffi, médecin ivoirien mature au stéthoscope",
};

/** Anneau Adinkra décoratif autour de l'avatar (SVG, pas le visage). */
function AdinkraRing({ size }: { size: number }) {
  const stroke = Math.max(1.2, size * 0.06);
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0 pointer-events-none"
    >
      <defs>
        <linearGradient id="aya-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F4C77B" />
          <stop offset="50%" stopColor="#E89B3C" />
          <stop offset="100%" stopColor="#9B3F1F" />
        </linearGradient>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="url(#aya-ring-grad)"
        strokeWidth={stroke}
        strokeDasharray={`${r * 0.18} ${r * 0.12}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

function createRipple(e: React.MouseEvent<HTMLDivElement>) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  target.appendChild(ripple);
  window.setTimeout(() => {
    ripple.remove();
  }, 600);
}

/**
 * Avatar persona photoréaliste (header 40px, bulles 32px).
 *
 * V4 — premium polish:
 *   - `withRing` (optional) wraps the photo in a `.avatar-ring-premium`
 *     gradient gold → terracotta ring (2px). Used on chat bubbles + typing
 *     indicator for a tactile, premium feel.
 *   - `isTyping` (optional) adds the `.is-typing` modifier on the ring,
 *     which pulses a soft gold glow while Sankofa is composing a reply.
 *   - When `withRing` is false (default — header), the avatar keeps the
 *     legacy flat treatment (no ring, no glow).
 */
function PersonaAvatar({
  persona,
  size,
  className,
  priority = false,
  withRing = false,
  isTyping = false,
}: {
  persona: Persona;
  size: number;
  className?: string;
  priority?: boolean;
  withRing?: boolean;
  isTyping?: boolean;
}) {
  const inner = (
    <div
      className="relative rounded-full overflow-hidden bg-terracotta"
      style={{ width: size, height: size }}
    >
      <img
        src={PERSONA_PHOTO[persona]}
        alt={PERSONA_ALT[persona]}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="object-cover w-full h-full"
      />
      <AdinkraRing size={size} />
    </div>
  );

  if (withRing) {
    return (
      <div
        className={cn(
          "avatar-ring-premium shrink-0",
          isTyping && "is-typing",
          className,
        )}
        style={{ width: size + 6, height: size + 6 }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-terracotta",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={PERSONA_PHOTO[persona]}
        alt={PERSONA_ALT[persona]}
        width={size}
        height={size}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="object-cover w-full h-full"
      />
      <AdinkraRing size={size} />
    </div>
  );
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  triageLevel?: "info" | "orientation" | "urgence";
  tpeActivated?: boolean;
  protocolUsed?: string | null;
  persona?: Persona;
  /** Message du mode compagnon (check-in / quick action) — style différencié. */
  companion?: boolean;
  /** V3+ — Message de l'IA Sentinelle Préventive (check-in proactif doux).
   *  Style vert-baobab pour se distinguer du mode compagnon (terracotta, urgent).
   *  Toujours accompagné de `sentinelActions` pour les boutons dismiss/respond. */
  sentinel?: boolean;
  /** V3+ — True si les boutons "Je vais bien / J'en parle" doivent être affichés. */
  sentinelActions?: boolean;
  /** V3 — Émotion détectée dans le message utilisateur (transparence + empathie). */
  emotion?: "détresse" | "anxieux" | "triste" | "colère" | "honte" | "neutre";
  /** V3 — Score d'intensité émotionnelle 0-1. */
  emotionIntensity?: number;
  /** V3 — True si Sankofa suggère un check-in émotionnel (détresse haute). */
  needsEmotionalCheckIn?: boolean;
  /** V3 — Recommandation de switch de persona (l'utilisateur garde le choix final). */
  personaRecommendation?: {
    recommended: "grande_soeur" | "grand_frere" | "tonton_medecin";
    current: "grande_soeur" | "grand_frere" | "tonton_medecin";
    shouldSuggest: boolean;
    reason: string;
  };
  /** V3 — Slugs des protocoles RAG utilisés (transparence). */
  protocolsUsed?: string[];
  /** V3 — Registre/tone détecté côté serveur (transparence). */
  register?: "nouchi" | "sober" | "soutenu" | "standard" | "familier";
}

interface ChatResponse {
  reply: string;
  triageLevel: "info" | "orientation" | "urgence";
  tpeActivated?: boolean;
  protocolUsed?: string | null;
  redFlagTopic?: string;
  persona: Persona;
  personaName?: string;
  personaLabel?: string;
  register?: "nouchi" | "sober" | "soutenu" | "standard" | "familier";
  userRegister?: "nouchi" | "soutenu" | "standard" | "familier";
  /** V3 — Émotion détectée + intensité + check-in émotionnel suggéré. */
  emotion?: "détresse" | "anxieux" | "triste" | "colère" | "honte" | "neutre";
  emotionIntensity?: number;
  needsEmotionalCheckIn?: boolean;
  /** V3 — Recommandation de persona (l'utilisateur garde le choix final). */
  personaRecommendation?: {
    recommended: "grande_soeur" | "grand_frere" | "tonton_medecin";
    current: "grande_soeur" | "grand_frere" | "tonton_medecin";
    shouldSuggest: boolean;
    reason: string;
  };
  /** V3 — Slugs des protocoles RAG utilisés (transparence). */
  protocolsUsed?: string[];
}

/**
 * Métadonnées reçues en premier événement SSE du stream /api/chat/stream
 * (type === "meta"). Contient triage, persona, registre, émotion, TPE,
 * protocoles utilisés, et potentiellement un redFlagTopic (sujet sensible).
 */
interface StreamMeta {
  triageLevel: "info" | "orientation" | "urgence" | null;
  persona: Persona;
  register?: "nouchi" | "sober" | "soutenu" | "standard" | "familier";
  emotion?: "détresse" | "anxieux" | "triste" | "colère" | "honte" | "neutre";
  emotionIntensity?: number;
  needsEmotionalCheckIn?: boolean;
  tpeActivated?: boolean;
  protocolUsed?: string | null;
  protocolsUsed?: string[];
  personaRecommendation?: {
    recommended: "grande_soeur" | "grand_frere" | "tonton_medecin";
    current: "grande_soeur" | "grand_frere" | "tonton_medecin";
    shouldSuggest: boolean;
    reason: string;
  };
  redFlagTopic?: RedFlagTopic;
}

const STORAGE_KEY = "aya:anonymousId";
const HISTORY_KEY = "aya:chatHistory";
const PERSONA_KEY = "aya:persona";
// Version du cache — incrémenter à chaque modification du welcome ou de la structure des messages.
// Force l'invalidation de l'historique localStorage pour éviter les hydration mismatches.
const HISTORY_VERSION = "v7-fr-nouchi";

interface PersonaMeta {
  id: Persona;
  label: string;
  sub: string;
  name: string;
  initials: string;
}

const PERSONAS: PersonaMeta[] = [
  {
    id: "grande_soeur",
    label: "Grande sœur",
    sub: "Aya · aînée bienveillante",
    name: "Aya",
    initials: "A",
  },
  {
    id: "grand_frere",
    label: "Grand frère",
    sub: "Yao · aîné protecteur",
    name: "Yao",
    initials: "Y",
  },
  {
    id: "tonton_medecin",
    label: "Tonton médecin",
    sub: "Tonton Koffi · clinicien",
    name: "Tonton Koffi",
    initials: "TK",
  },
];

/** Map rapide persona → prénom (transparence V3). */
const PERSONA_NAME: Record<Persona, string> = {
  grande_soeur: "Aya",
  grand_frere: "Yao",
  tonton_medecin: "Tonton Koffi",
};

/** Message d'accueil personnalisé par persona. */
function buildWelcomeMessage(persona: Persona): ChatMessage {
  let content: string;
  if (persona === "grande_soeur") {
    content =
      "Salut poto 👋, ici c'est Sankofa.\n\n" +
      "100% anonyme, zéro jugement, je suis là pour toi 24/7. Tu peux me parler santé sexuelle, " +
      "addiction, peau, moral, nutrition... tout ce qui te trotte dans la tête.\n\n" +
      "Y'a pas drap, on est ensemble. 🌿\n\n" +
      "Vas-y, clique sur une suggestion en forme de cauris, ou tape ta question.";
  } else if (persona === "grand_frere") {
    content =
      "Yo mon frère 👋, ici c'est Yao.\n\n" +
      "100% anonyme, zéro jugement, je suis là pour toi 24/7. On parle santé, filles, contraception, " +
      "tramadol, acné, examens, bouffe... tout ce qui te tracasse.\n\n" +
      "Y'a pas drap, on est ensemble. 🌿\n\n" +
      "Vas-y, clique sur une suggestion ou tape ta question direct.";
  } else {
    // tonton_medecin
    content =
      "Bonjour 👋, ici c'est Tonton Koffi.\n\n" +
      "100% anonyme, je suis là pour t'orienter 24/7. Pose-moi tes questions sur la contraception, " +
      "les IST, le TPE 72h, le tramadol, la peau, le stress, la nutrition... Je t'explique le pourquoi, sans jargon.\n\n" +
      "On prend soin de toi ensemble. 🌿\n\n" +
      "Vas-y, clique sur une suggestion ou tape ta question.";
  }
  return {
    id: `welcome-${persona}`,
    role: "assistant",
    content,
    ts: 0,
    persona,
  };
}

// Sentinel welcome (initial, replaced client-side once persona is loaded)
const WELCOME_MESSAGE: ChatMessage = buildWelcomeMessage("grande_soeur");

const SUGGESTIONS = [
  // SSR
  { label: "Rapport non protégé hier soir", emoji: "⚠️" },
  { label: "Pilule du lendemain", emoji: "💊" },
  { label: "Brûlure en urinant, c'est grave ?", emoji: "🔥" },
  { label: "Mon préservatif a craqué", emoji: "💥" },
  // Addictologie
  { label: "Je consomme trop de tramadol", emoji: "💊" },
  { label: "Comment arrêter le tabac ?", emoji: "🚬" },
  // Dermatologie
  { label: "Crème éclaircissante, danger ?", emoji: "🧴" },
  { label: "J'ai de l'acné, que faire ?", emoji: "😌" },
  // Santé mentale
  { label: "Je me sens triste tout le temps", emoji: "🤍" },
  { label: "Stress pour mes examens", emoji: "📚" },
  // Nutrition
  { label: "Comment bien manger pas cher ?", emoji: "🍌" },
  { label: "Les compléments alimentaires, safe ?", emoji: "🧪" },
  // Multilingue — audio bientôt (Dioula & Baoulé à l'oral)
  // Les jeunes ivoiriens parlent ces langues mais les écrivent rarement.
  // L'audio (ASR/TTS) permettra de les parler plutôt que les écrire.
];

function formatTime(ts: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getAnonymousId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = uuidv4();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return uuidv4();
  }
}

function loadHistory(persona: Persona): ChatMessage[] {
  if (typeof window === "undefined") return [buildWelcomeMessage(persona)];
  try {
    // Check version — if mismatch, clear old history and start fresh
    const storedVersion = window.localStorage.getItem("aya:historyVersion");
    if (storedVersion !== HISTORY_VERSION) {
      window.localStorage.removeItem(HISTORY_KEY);
      window.localStorage.setItem("aya:historyVersion", HISTORY_VERSION);
      return [buildWelcomeMessage(persona)];
    }

    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [buildWelcomeMessage(persona)];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [buildWelcomeMessage(persona)];

    // Invalider les anciens welcome messages si leur contenu ne correspond plus
    // au welcome actuel (évite hydration mismatch quand le welcome change entre versions)
    const currentWelcome = buildWelcomeMessage(persona);
    const updated = parsed.map((msg) => {
      if (
        typeof msg.id === "string" &&
        msg.id.startsWith("welcome-") &&
        msg.content !== currentWelcome.content
      ) {
        return { ...msg, content: currentWelcome.content, persona };
      }
      return msg;
    });
    return updated;
  } catch {
    return [buildWelcomeMessage(persona)];
  }
}

function saveHistory(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-50);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage plein ou bloqué
  }
}

function loadPersona(): Persona {
  if (typeof window === "undefined") return "grande_soeur";
  try {
    const stored = window.localStorage.getItem(PERSONA_KEY) as Persona | null;
    if (stored && ["grande_soeur", "grand_frere", "tonton_medecin"].includes(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return "grande_soeur";
}

function TriageBadge({ level }: { level: "info" | "orientation" | "urgence" }) {
  if (level === "info") return null;
  if (level === "orientation") {
    return (
      <Badge
        variant="outline"
        className="bg-ambre-couchant/15 border-ambre-couchant/40 text-ocre-rouge gap-1"
      >
        <Stethoscope className="size-3" />
        Orientation conseillée
      </Badge>
    );
  }
  return (
    <Badge className="bg-ocre-rouge text-text-on-dark border-0 gap-1">
      <AlertTriangle className="size-3" />
      Urgence — voir structure
    </Badge>
  );
}

/**
 * SpeakButton — écouter une réponse de Sankofa (TTS).
 *
 * Bouton "Écouter" placé à côté de "Sauver dans mon carnet". Au clic, on POST
 * le texte + persona vers /api/chat/speak, qui renvoie un MP3 qu'on joue via
 * un élément `Audio` créé en mémoire (pas de node DOM supplémentaire par bulle).
 *
 * États :
 *   - idle : icône Volume2 + "Écouter"
 *   - loading (fetch TTS) : Loader2 spinning
 *   - playing : icône Square + "Stop" — clic = stop
 *
 * Le `Audio` est créé dans un useEffect (client-only) → pas d'accès `window`
 * pendant le rendu → pas de hydration mismatch.
 */
function SpeakButton({ text, persona }: { text: string; persona: Persona }) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      toast.error("Lecture audio impossible", {
        description: "Le format audio n'a pas pu être lu par ton navigateur.",
      });
    };
    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
        audio.src = "";
      } catch {
        // ignore
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      audioRef.current = null;
    };
  }, []);

  const handleSpeak = React.useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Si déjà en train de jouer → on arrête.
    if (isPlaying) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      setIsPlaying(false);
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/chat/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, persona }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("Audio vide reçu du serveur.");
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      audio.src = url;
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error("Synthèse vocale impossible", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, text, persona]);

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={isLoading}
      aria-label={
        isPlaying
          ? "Arrêter la lecture audio de la réponse"
          : "Écouter la réponse de Sankofa à voix haute"
      }
      title={isPlaying ? "Arrêter l'audio" : "Écouter — Sankofa te parle"}
      className="inline-flex items-center gap-1 text-[10px] text-ocre-rouge hover:text-terracotta font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-ocre-rouge/10 disabled:opacity-50 disabled:cursor-wait"
    >
      {isLoading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : isPlaying ? (
        <Square className="size-3 fill-current" />
      ) : (
        <Volume2 className="size-3" />
      )}
      {isPlaying ? "Stop" : "Écouter"}
    </button>
  );
}

/**
 * FeedbackButtons — 👍/👎 sur une réponse assistant (V3 — boucle d'apprentissage).
 *
 * Envoie le vote à /api/chat/feedback avec contexte (persona, triage, émotion).
 * Un seul vote par message (désactive les deux boutons après clic).
 * Couleurs : vert-baobab (up), terracotta (down) — palette Sankofa.
 */
function FeedbackButtons({ msg, anonymousId }: { msg: ChatMessage; anonymousId: string }) {
  const [vote, setVote] = React.useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleVote = React.useCallback(
    async (thumb: "up" | "down") => {
      if (vote || submitting || !anonymousId) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anonymousId,
            messageTs: msg.ts,
            messageRole: "assistant",
            messagePreview: msg.content.slice(0, 100),
            thumb,
            triageLevel: msg.triageLevel,
            persona: msg.persona,
            emotion: msg.emotion,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        setVote(thumb);
        toast.success("Merci ! Ton avis m'aide à m'améliorer.");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        toast.error("Impossible d'enregistrer ton vote", { description: errMsg });
      } finally {
        setSubmitting(false);
      }
    },
    [anonymousId, msg, submitting, vote],
  );

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => handleVote("up")}
        disabled={!!vote || submitting}
        aria-label="Bonne réponse"
        aria-pressed={vote === "up"}
        title="Bonne réponse 👍"
        className={cn(
          "p-1 rounded transition-colors disabled:cursor-default",
          vote === "up"
            ? "bg-vert-baobab/15 text-vert-baobab"
            : "text-ocre-rouge hover:bg-vert-baobab/10 hover:text-vert-baobab",
        )}
      >
        <ThumbsUp className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => handleVote("down")}
        disabled={!!vote || submitting}
        aria-label="Réponse à améliorer"
        aria-pressed={vote === "down"}
        title="Réponse à améliorer 👎"
        className={cn(
          "p-1 rounded transition-colors disabled:cursor-default",
          vote === "down"
            ? "bg-terracotta/15 text-terracotta"
            : "text-ocre-rouge hover:bg-terracotta/10 hover:text-terracotta",
        )}
      >
        <ThumbsDown className="size-3" />
      </button>
    </div>
  );
}

/**
 * TransparencyPanel — "Pourquoi cette réponse ?" (V3 — transparence).
 *
 * Petit card affichant le persona, registre, triage, protocoles, émotion, TPE.
 * Vise à démystifier la chaîne de traitement pour l'utilisateur·rice.
 */
function TransparencyPanel({ msg }: { msg: ChatMessage }) {
  const personaName = msg.persona ? PERSONA_NAME[msg.persona] : "Aya";
  const protocols =
    msg.protocolsUsed && msg.protocolsUsed.length > 0
      ? msg.protocolsUsed.join(", ")
      : "Aucun";
  const emotionLabel = msg.emotion
    ? `${msg.emotion} (${Math.round((msg.emotionIntensity ?? 0) * 100)}%)`
    : "Non détectée";
  const triageLabel = msg.triageLevel ?? "info";

  return (
    <div className="bg-creme-baobab/60 border border-ocre-rouge/15 rounded-lg p-3 text-xs text-ocre-rouge space-y-1 w-full">
      <p className="font-semibold text-ocre-rouge/80 mb-1.5">ℹ️ Pourquoi cette réponse ?</p>
      <div className="flex gap-2">
        <span className="font-semibold min-w-[110px] shrink-0">Persona</span>
        <span>{personaName}</span>
      </div>
      <div className="flex gap-2">
        <span className="font-semibold min-w-[110px] shrink-0">Registre</span>
        <span>{msg.register ?? "—"}</span>
      </div>
      <div className="flex gap-2">
        <span className="font-semibold min-w-[110px] shrink-0">Niveau triage</span>
        <span>{triageLabel}</span>
      </div>
      <div className="flex gap-2">
        <span className="font-semibold min-w-[110px] shrink-0">Protocoles utilisés</span>
        <span className="break-words">{protocols}</span>
      </div>
      <div className="flex gap-2">
        <span className="font-semibold min-w-[110px] shrink-0">Émotion détectée</span>
        <span>{emotionLabel}</span>
      </div>
      <div className="flex gap-2">
        <span className="font-semibold min-w-[110px] shrink-0">TPE</span>
        <span>{msg.tpeActivated ? "Oui" : "Non"}</span>
      </div>

      {/* Badge "Pas un diagnostic" — limite claire */}
      <div className="mt-2 pt-2 border-t border-ocre-rouge/15">
        <div className="flex items-center gap-1.5 text-terracotta font-semibold">
          <span className="text-base">⚠️</span>
          <span>Pas un diagnostic médical</span>
        </div>
        <p className="text-ocre-rouge/70 mt-1 leading-snug">
          Sankofa donne des pistes éducatives, pas un diagnostic. Seul un médecin peut confirmer.
        </p>
      </div>

      {/* Bouton "Voir un médecin" — orientation proéminente */}
      <a
        href="/?tab=tpe"
        onClick={(e) => {
          e.preventDefault();
          // Scroll vers la section centres TPE (même comportement que SOS 72h)
          window.dispatchEvent(new CustomEvent("sankofa:goto-tpe"));
        }}
        className="press mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-terracotta/15 border border-terracotta/30 text-terracotta text-xs font-bold hover:bg-terracotta/25 transition-colors"
      >
        <Stethoscope className="size-3.5" />
        Voir un médecin
      </a>
    </div>
  );
}

/**
 * PersonaSuggestionBanner — suggestion de switch de persona (V3).
 *
 * Affichée quand le backend détecte qu'un autre persona serait plus adapté.
 * L'utilisateur garde le choix final (pas d'auto-switch).
 */
function PersonaSuggestionBanner({
  recommendation,
  onSwitch,
  onDismiss,
}: {
  recommendation: NonNullable<ChatMessage["personaRecommendation"]>;
  onSwitch: (p: Persona) => void;
  onDismiss: () => void;
}) {
  const recommendedName =
    PERSONA_NAME[recommendation.recommended] ?? recommendation.recommended;
  return (
    <div className="bg-ambre-couchant/15 border border-ambre-couchant/30 rounded-lg p-2.5 text-xs flex items-center gap-2 text-ocre-rouge w-full">
      <span className="flex-1 leading-snug">{recommendation.reason}</span>
      <button
        type="button"
        onClick={() => onSwitch(recommendation.recommended)}
        aria-label={`Passer à ${recommendedName}`}
        title={`Passer à ${recommendedName}`}
        className="shrink-0 px-2 py-1 rounded bg-ambre-couchant/30 hover:bg-ambre-couchant/50 text-ocre-rouge font-medium transition-colors whitespace-nowrap"
      >
        Switch to {recommendedName}?
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Rejeter la suggestion de persona"
        title="Non merci"
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-ocre-rouge/10 text-ocre-rouge font-medium transition-colors whitespace-nowrap"
      >
        <X className="size-3" />
        <span className="hidden sm:inline">Non merci</span>
      </button>
    </div>
  );
}

/**
 * SentinelActions — boutons "Je vais bien / J'en parle" sous une bulle sentinelle.
 *
 * Deux actions possibles pour un check-in proactif de l'IA Sentinelle :
 *  - onDismiss : l'utilisateur·rice dit "Je vais bien, merci" → on retire la bulle.
 *  - onRespond : l'utilisateur·rice veut en parler → on focus l'input
 *    + on pré-remplit avec un message doux pour ouvrir la voie.
 *
 * Style : deux petits boutons vert-baobab / outline, calqués sur les PersonaSuggestion
 * buttons pour cohérence visuelle.
 */
function SentinelActions({
  onDismiss,
  onRespond,
}: {
  onDismiss: () => void;
  onRespond: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1.5 w-full">
      <button
        type="button"
        onClick={onRespond}
        aria-label="J'ai besoin d'en parler"
        title="J'ai besoin d'en parler"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-vert-baobab/15 hover:bg-vert-baobab/25 text-vert-baobab font-medium text-xs transition-colors"
      >
        🤍 J&apos;en parle
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Je vais bien, merci — fermer le check-in"
        title="Je vais bien, merci"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-ocre-rouge/10 text-ocre-rouge font-medium text-xs transition-colors"
      >
        <X className="size-3" />
        Je vais bien, merci
      </button>
    </div>
  );
}

function MessageBubble({
  msg,
  index = 0,
  onSaveToCarnet,
  anonymousId,
  onSwitchPersona,
  onSentinelDismiss,
  onSentinelRespond,
}: {
  msg: ChatMessage;
  index?: number;
  onSaveToCarnet?: (msg: ChatMessage) => void;
  anonymousId?: string;
  onSwitchPersona?: (p: Persona) => void;
  onSentinelDismiss?: (msg: ChatMessage) => void;
  onSentinelRespond?: (msg: ChatMessage) => void;
}) {
  const isUser = msg.role === "user";
  const isCompanion = !!msg.companion && !isUser;
  const isSentinel = !!msg.sentinel && !isUser;
  const canSaveToCarnet =
    !isUser && onSaveToCarnet && !msg.id.startsWith("welcome-") && !msg.id.startsWith("switch-");
  // Le bouton "Écouter" (TTS) apparaît sur les bulles assistant réelles
  // (pas user, pas companion, pas welcome, pas switch, contenu non vide).
  const canSpeak =
    !isUser &&
    !isCompanion &&
    !msg.id.startsWith("welcome-") &&
    !msg.id.startsWith("switch-") &&
    msg.content.trim().length > 0;
  // V3 — Boutons feedback + transparence + suggestion de persona :
  // uniquement sur les vraies réponses assistant (pas welcome/switch/companion).
  const isAssistantReal =
    !isUser &&
    !isCompanion &&
    !msg.id.startsWith("welcome-") &&
    !msg.id.startsWith("switch-");
  const [showTransparency, setShowTransparency] = React.useState(false);
  const [personaSuggestionDismissed, setPersonaSuggestionDismissed] =
    React.useState(false);
  const showPersonaSuggestion =
    isAssistantReal &&
    !!msg.personaRecommendation?.shouldSuggest &&
    !personaSuggestionDismissed;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: Math.min(index * 0.05, 0.3) }}
      className={cn("flex w-full gap-2", isUser ? "justify-end" : "justify-start")}
      aria-label={isSentinel ? "Check-in proactif de Sankofa (IA Sentinelle)" : isCompanion ? "Message de compagnon de Sankofa" : undefined}
    >
      {!isUser && (
        <PersonaAvatar
          persona={msg.persona ?? "grande_soeur"}
          size={32}
          withRing
          className="mt-0.5"
        />
      )}
      <div className={cn("flex flex-col max-w-[82%] sm:max-w-[75%] gap-1", isUser ? "items-end" : "items-start")}>
        {msg.triageLevel && msg.triageLevel !== "info" && !isUser && (
          <TriageBadge level={msg.triageLevel} />
        )}
        {msg.tpeActivated && !isUser && (
          <Badge className="bg-terracotta/20 border border-terracotta/40 text-ocre-rouge gap-1">
            ⏱️ TPE 72h activé
          </Badge>
        )}
        <div
          onClick={isUser ? createRipple : undefined}
          className={cn(
            "px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words leading-relaxed",
            isUser
              ? "bubble-glass-user ripple-container"
              : isSentinel
                ? "aya-bubble-sentinel"
                : isCompanion
                  ? "aya-bubble-companion border-l-4 border-l-terracotta"
                  : "bubble-glass-assistant ripple-container",
          )}
        >
          {msg.content}
        </div>
        {showPersonaSuggestion && msg.personaRecommendation && (
          <PersonaSuggestionBanner
            recommendation={msg.personaRecommendation}
            onSwitch={(p) => {
              onSwitchPersona?.(p);
              setPersonaSuggestionDismissed(true);
            }}
            onDismiss={() => setPersonaSuggestionDismissed(true)}
          />
        )}
        {isSentinel && msg.sentinelActions && (
          <SentinelActions
            onDismiss={() => onSentinelDismiss?.(msg)}
            onRespond={() => onSentinelRespond?.(msg)}
          />
        )}
        <div className={cn("flex items-center gap-2 flex-wrap", isUser ? "justify-end" : "justify-start")}>
          {isSentinel ? (
            <span className="text-[10px] text-vert-baobab font-medium px-1">
              🌿 Sentinelle · Sankofa veille sur toi
            </span>
          ) : isCompanion ? (
            <span className="text-[10px] text-ocre-rouge font-medium px-1">
              🌿 Compagnon
            </span>
          ) : msg.ts > 0 ? (
            <span
              suppressHydrationWarning
              className="text-[10px] text-text-on-light-muted px-1"
            >
              {formatTime(msg.ts)}
            </span>
          ) : null}
          {canSaveToCarnet && (
            <button
              type="button"
              onClick={() => onSaveToCarnet?.(msg)}
              className="inline-flex items-center gap-1 text-[10px] text-ocre-rouge hover:text-terracotta font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-ocre-rouge/10"
              aria-label="Sauvegarder cette réponse dans le carnet chiffré"
              title="Sauver dans mon carnet chiffré"
            >
              <Lock className="size-3" />
              Sauver dans mon carnet
            </button>
          )}
          {canSpeak && (
            <SpeakButton text={msg.content} persona={msg.persona ?? "grande_soeur"} />
          )}
          {isAssistantReal && anonymousId && (
            <FeedbackButtons msg={msg} anonymousId={anonymousId} />
          )}
          {isAssistantReal && (
            <button
              type="button"
              onClick={() => setShowTransparency((v) => !v)}
              aria-label="Voir pourquoi cette réponse"
              aria-expanded={showTransparency}
              title="Pourquoi cette réponse ?"
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium transition-colors px-1.5 py-0.5 rounded",
                showTransparency
                  ? "bg-ocre-rouge/15 text-ocre-rouge"
                  : "text-ocre-rouge hover:bg-ocre-rouge/10",
              )}
            >
              <Info className="size-3" />
              <span className="hidden sm:inline">Pourquoi ?</span>
            </button>
          )}
        </div>
        {isAssistantReal && showTransparency && (
          <TransparencyPanel msg={msg} />
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ persona }: { persona: Persona }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex gap-2 justify-start"
    >
      <PersonaAvatar
        persona={persona}
        size={32}
        withRing
        isTyping
        className="mt-0.5"
      />
      <div className="bubble-glass-assistant px-4 py-3 flex items-center gap-1.5">
        <span className="aya-typing-dot size-2 rounded-full bg-or-poudre-clair inline-block" />
        <span className="aya-typing-dot size-2 rounded-full bg-or-poudre-clair inline-block" />
        <span className="aya-typing-dot size-2 rounded-full bg-or-poudre-clair inline-block" />
        <span className="sr-only">Sankofa écrit...</span>
      </div>
    </motion.div>
  );
}

interface ChatProps {
  className?: string;
  onSaveToCarnet?: (msg: ChatMessage) => void;
  /** Question pré-remplie depuis l'onglet Coach (ex: "En savoir plus →") */
  pendingQuestion?: string | null;
  /** Appelé quand pendingQuestion a été consommée (injectée dans l'input) */
  onPendingQuestionConsumed?: () => void;
  /** Callback scroll pour auto-hide nav Instagram-style (mobile only) */
  onScrollNavToggle?: (e: React.UIEvent<HTMLElement>) => void;
}

export function Chat({
  className,
  onSaveToCarnet,
  pendingQuestion,
  onPendingQuestionConsumed,
  onScrollNavToggle,
}: ChatProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);
  const [anonymousId, setAnonymousId] = React.useState<string>("");
  const [persona, setPersona] = React.useState<Persona>("grande_soeur");
  const [companionMode, setCompanionMode] = React.useState<CompanionState>(
    INITIAL_COMPANION_STATE,
  );
  // === Audio (ASR/TTS) ===
  // `mounted` permet de ne rendre le bouton micro qu'après hydratation
  // (MediaRecorder n'existe pas côté serveur).
  const [mounted, setMounted] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  // Send-success animation — apply .send-success for 600ms on submit.
  const [sendFlipping, setSendFlipping] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingStreamRef = React.useRef<MediaStream | null>(null);
  // Authentification optionnelle (Task 12). Session reste "loading" au premier render
  // (server) puis résout vers "authenticated" | "unauthenticated" côté client.
  // Pas d'impact sur l'anonymat — si non authentifié, on envoie simplement userId=null.
  const { data: session, status: sessionStatus } = useSession();
  const userId = React.useMemo(
    () => (sessionStatus === "authenticated" ? (session?.user as { id?: string } | undefined)?.id ?? null : null),
    [session, sessionStatus],
  );

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Ref miroir de l'état compagnon pour les callbacks d'interval (évite les stale closures)
  const companionRef = React.useRef<CompanionState>(companionMode);
  React.useEffect(() => {
    companionRef.current = companionMode;
  }, [companionMode]);

  // === Audio : hydratation + cleanup du MediaRecorder ===
  // `mounted` passe à true côté client après hydratation → le bouton micro
  // devient actif. SSR et premier render client sont identiques (bouton désactivé)
  // donc pas de mismatch d'hydratation.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup en démontage : on arrête proprement le recorder et les tracks du
  // microphone pour éviter un voyant "micro actif" orphelin dans le navigateur.
  React.useEffect(() => {
    return () => {
      try {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
      } catch {
        // ignore
      }
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    };
  }, []);

  /**
   * Démarre l'enregistrement audio via MediaRecorder (webm/opus de préférence,
   * fallback ogg/opus, fallback navigateur par défaut).
   *
   * On ne demande la permission qu'au clic — pas de prompt au chargement de page
   * (meilleur UX, évite le rejet automatique).
   */
  const startRecording = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      toast.error("Microphone non disponible", {
        description: "Ton navigateur ne supporte pas l'enregistrement audio.",
      });
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      // Déjà en train d'enregistrer — on ignore.
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        toast.error("Microphone non disponible", {
          description:
            "Tu dois autoriser l'accès au micro dans ton navigateur (icône cadenas à côté de l'URL).",
        });
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        toast.error("Aucun microphone détecté", {
          description: "Branche un micro ou un casque avec micro et réessaie.",
        });
      } else {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        toast.error("Microphone non disponible", { description: msg });
      }
      return;
    }

    recordingStreamRef.current = stream;

    // Choisit le meilleur mime type supporté par ce navigateur.
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    const mimeType =
      candidates.find((c) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c),
      ) || "";

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "MediaRecorder indisponible";
      toast.error("Microphone non disponible", { description: msg });
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
      return;
    }

    audioChunksRef.current = [];

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      // Libère le micro immédiatement (avant la transcription réseau).
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;

      const audioBlob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      audioChunksRef.current = [];

      if (audioBlob.size === 0) {
        toast.error("Enregistrement vide", {
          description: "Aucun son n'a été capturé. Réessaie en parlant plus près du micro.",
        });
        return;
      }

      setIsTranscribing(true);
      try {
        const formData = new FormData();
        const ext = (recorder.mimeType || "audio/webm").includes("ogg")
          ? "ogg"
          : "webm";
        formData.append("audio", audioBlob, `recording.${ext}`);

        const res = await fetch("/api/chat/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        const data = (await res.json()) as { text: string };
        const text = (data.text || "").trim();

        if (!text) {
          toast.error("Je n'ai pas compris l'audio", {
            description:
              "Parle plus clairement, dans un endroit calme, et évite le bruit de fond.",
          });
          return;
        }

        // On remplit l'input SANS auto-envoyer : l'utilisateur·rice vérifie
        // la transcription avant de cliquer sur Envoyer (sécurité + contrôle).
        setInput((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${text}` : text;
        });
        toast.success("Audio transcrit 👍", {
          description: "Vérifie le texte avant d'envoyer.",
        });
        inputRef.current?.focus();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        toast.error("Transcription impossible", { description: msg });
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.onerror = () => {
      toast.error("Erreur d'enregistrement", {
        description: "Le micro a rencontré un problème. Réessaie.",
      });
      setIsRecording(false);
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    };

    try {
      recorder.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Impossible de démarrer le micro";
      toast.error("Microphone non disponible", { description: msg });
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
      return;
    }

    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  /** Arrête l'enregistrement — déclenche onstop (transcription) via MediaRecorder. */
  const stopRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }
    try {
      recorder.stop();
    } catch {
      // ignore — on force le reset visuel
    }
    setIsRecording(false);
  }, []);

  /** Ajoute un message compagnon (check-in / quick action) — pré-écrit, sans LLM. */
  const sendCompanionMessage = React.useCallback(
    (content: string, personaOverride?: Persona) => {
      if (!content) return;
      const msg: ChatMessage = {
        id: `companion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "assistant",
        content,
        ts: Date.now(),
        persona: personaOverride,
        companion: true,
      };
      setMessages((prev) => [...prev, msg]);
    },
    [],
  );

  /** Active le mode compagnon (ne fait rien si déjà actif). */
  const activateCompanion = React.useCallback(
    (
      trigger: "tpe" | "red_flag" | "manual",
      redFlagTopic?: RedFlagTopic,
      personaOverride?: Persona,
    ) => {
      let activated = false;
      setCompanionMode((prev) => {
        if (prev.active) return prev;
        activated = true;
        const now = Date.now();
        const newState: CompanionState = {
          active: true,
          startedAt: now,
          trigger,
          redFlagTopic,
          stage: "departing",
          lastCheckIn: now,
          checkInCount: 1, // le message d'activation compte comme check-in 1
        };
        return newState;
      });
      if (activated) {
        const msg = getCheckInMessage(trigger, redFlagTopic, 0);
        sendCompanionMessage(msg, personaOverride);
      }
    },
    [sendCompanionMessage],
  );

  /** Réinitialise le compteur de check-ins (utilisateur·rice engagé·e). */
  const resetCheckInTimer = React.useCallback(() => {
    setCompanionMode((prev) => {
      if (!prev.active) return prev;
      return {
        ...prev,
        checkInCount: 0,
        lastCheckIn: Date.now(),
      };
    });
  }, []);

  /** Gère les 4 quick actions du mode compagnon. */
  const handleQuickAction = React.useCallback(
    (actionId: CompanionQuickAction["id"]) => {
      const current = companionRef.current;
      if (!current.active) return;
      const response = getQuickActionResponse(actionId);
      sendCompanionMessage(response);

      switch (actionId) {
        case "en_route":
          setCompanionMode((prev) => ({
            ...prev,
            stage: "in_transit",
            checkInCount: 0,
            lastCheckIn: Date.now(),
          }));
          break;
        case "parler":
          resetCheckInTimer();
          break;
        case "arrived": {
          // Offre de sauvegarder la consultation dans le carnet chiffré
          if (onSaveToCarnet) {
            const triggerLabel = getTriggerLabel(current);
            const dateStr = new Date().toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            });
            const syntheticMsg: ChatMessage = {
              id: `companion-save-${Date.now()}`,
              role: "assistant",
              content: `Consultation terminée — ${triggerLabel}. Arrivé·e à la structure le ${dateStr}.`,
              ts: Date.now(),
              persona,
              companion: true,
            };
            onSaveToCarnet(syntheticMsg);
          }
          // Transition vers « completed » → bannière change, puis fade après 5s
          setCompanionMode((prev) => ({ ...prev, stage: "completed" }));
          window.setTimeout(() => {
            setCompanionMode((prev) => ({ ...prev, active: false }));
          }, 5000);
          break;
        }
        case "stop":
          setCompanionMode((prev) => ({
            ...prev,
            stage: "cancelled",
            active: false,
          }));
          break;
      }
    },
    [onSaveToCarnet, persona, resetCheckInTimer, sendCompanionMessage],
  );

  /** Fermeture de la bannière (X) — demande confirmation. */
  const handleDismissCompanion = React.useCallback(() => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Arrêter le mode compagnon ? Sankofa ne t'enverra plus de check-ins, mais restera disponible si tu as besoin.",
      );
      if (!ok) return;
    }
    const stopMsg = getQuickActionResponse("stop");
    sendCompanionMessage(stopMsg);
    setCompanionMode((prev) => ({
      ...prev,
      stage: "cancelled",
      active: false,
    }));
  }, [sendCompanionMessage]);

  // Init: load history + anonymous ID + persona + companion state (client-only)
  React.useEffect(() => {
    const loadedPersona = loadPersona();
    setPersona(loadedPersona);
    setAnonymousId(getAnonymousId());
    const loadedMessages = loadHistory(loadedPersona);
    setMessages(loadedMessages);

    // Charge l'état compagnon persisté (survit aux rechargements)
    const loadedCompanion = loadCompanionState();
    if (loadedCompanion) {
      setCompanionMode(loadedCompanion);
      if (loadedCompanion.stage === "completed") {
        // La bannière « terminé » est encore visible, on programme le fade
        window.setTimeout(() => {
          setCompanionMode((prev) => ({ ...prev, active: false }));
        }, 5000);
      } else if (loadedCompanion.stage === "cancelled") {
        // Déjà annulé — on désactive proprement
        setCompanionMode((prev) => ({ ...prev, active: false }));
      } else {
        // Mode compagnon toujours actif → message de retour
        // (reset du timer pour éviter le spam de check-ins au retour)
        setCompanionMode((prev) => ({
          ...prev,
          lastCheckIn: Date.now(),
        }));
        const lastMsg = loadedMessages[loadedMessages.length - 1];
        if (!lastMsg || lastMsg.content !== COMPANION_RESUME_MESSAGE) {
          sendCompanionMessage(COMPANION_RESUME_MESSAGE, loadedPersona);
        }
      }
    }
  }, [sendCompanionMessage]);

  React.useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isTyping]);

  React.useEffect(() => {
    if (anonymousId) saveHistory(messages);
  }, [messages, anonymousId]);

  // Persiste l'état compagnon dans localStorage à chaque changement
  React.useEffect(() => {
    saveCompanionState(companionMode);
  }, [companionMode]);

  // Check-in interval — envoie le prochain check-in toutes les 45s (démo)
  // ou auto-annule après 5 check-ins sans réponse.
  React.useEffect(() => {
    if (!companionMode.active) return;
    if (companionMode.stage === "completed" || companionMode.stage === "cancelled") return;

    const interval = window.setInterval(() => {
      const current = companionRef.current;
      if (!current.active || current.stage === "completed" || current.stage === "cancelled") return;

      if (current.checkInCount >= COMPANION_MAX_CHECK_INS) {
        // Auto-annulation : 5 check-ins sans réponse
        sendCompanionMessage(COMPANION_AUTO_CANCEL_MESSAGE);
        setCompanionMode((prev) => ({
          ...prev,
          stage: "cancelled",
          active: false,
        }));
        return;
      }

      const msg = getCheckInMessage(
        current.trigger,
        current.redFlagTopic,
        current.checkInCount,
      );
      sendCompanionMessage(msg);
      setCompanionMode((prev) => ({
        ...prev,
        checkInCount: prev.checkInCount + 1,
        lastCheckIn: Date.now(),
      }));
    }, COMPANION_CHECK_IN_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [companionMode.active, companionMode.stage, sendCompanionMessage]);

  // === IA Sentinelle Préventive — check-in proactif (V3+) ===
  // Sankofa VEILLE sur les patterns émotionnels et initie un check-in doux
  // si besoin (au lieu de seulement réagir aux messages).
  //
  // Hydration-safe : la sentinelle ne tourne QUE côté client, après mount
  // + après qu'une vraie interaction utilisateur s'est produite (saisie ou
  // envoi d'un message). Aucune analyse au premier render serveur → pas
  // de mismatch.
  //
  // Triggers :
  //   1. Tous les 5 messages utilisateur (lastCheckedCountRef garde mémoire).
  //   2. Sur visibilitychange → visible (retour d'onglet).
  //
  // Garde-fous (une fois par jour maximum) :
  //   - ref sentinelCheckedRef.current : empêche le re-trigger dans la même session.
  //   - localStorage `sankofa:sentinel-checked-{YYYY-MM-DD}` : empêche le re-trigger
  //     entre sessions la même journée.
  const sentinelCheckedRef = React.useRef(false);
  const lastSentinelCheckCountRef = React.useRef(0);

  /** Récupère la clé jour YYYY-MM-DD en heure locale (cohérente avec les autres features). */
  const getSentinelDayKey = React.useCallback((): string => {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch {
      return "unknown";
    }
  }, []);

  /** Lit le flag localStorage "déjà checké aujourd'hui". */
  const hasSentinelCheckedToday = React.useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(`sankofa:sentinel-checked-${getSentinelDayKey()}`) === "1";
    } catch {
      return false;
    }
  }, [getSentinelDayKey]);

  /** Marque la sentinelle comme ayant fait son check-in aujourd'hui. */
  const markSentinelCheckedToday = React.useCallback((): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`sankofa:sentinel-checked-${getSentinelDayKey()}`, "1");
    } catch {
      // localStorage plein ou bloqué — on a quand même le ref de session.
    }
  }, [getSentinelDayKey]);

  /** Lance une analyse sentinelle. Idempotent via les 2 garde-fous (ref + localStorage). */
  const runSentinelCheck = React.useCallback(
    async (force = false): Promise<void> => {
      // Garde-fous d'environnement : pas avant mount, pas sans anonymousId.
      if (!mounted) return;
      if (!anonymousId) return;
      // Garde-fous de session/jour (sauf si force=true — pour tests).
      if (!force && sentinelCheckedRef.current) return;
      if (!force && hasSentinelCheckedToday()) {
        sentinelCheckedRef.current = true;
        return;
      }

      // Prépare le payload : messages récents (user + assistant), en excluant
      // welcome / switch / companion / sentinel eux-mêmes (pas pertinents pour
      // l'analyse émotionnelle).
      const recentMessages = messages
        .filter(
          (m) =>
            !m.id.startsWith("welcome-") &&
            !m.id.startsWith("switch-") &&
            !m.id.startsWith("companion-") &&
            !m.id.startsWith("sentinel-"),
        )
        .slice(-30)
        .map((m) => ({
          role: m.role,
          content: m.content,
          ts: m.ts,
          emotion: m.emotion,
        }));

      // Pas assez de messages pour une analyse fiable → on skip silencieusement.
      if (recentMessages.filter((m) => m.role === "user").length < 3) return;

      try {
        const res = await fetch("/api/sentinel/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonymousId, recentMessages }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          shouldCheckIn?: boolean;
          suggestedMessage?: string;
          trend?: string;
        };
        if (!data.shouldCheckIn || !data.suggestedMessage) return;

        // === Check-in proactif ===
        // On ajoute une bulle "sentinelle" (style vert-baobab, distinct du compagnon).
        // Le message est pré-écrit, doux, jamais alarmant.
        const sentinelMsg: ChatMessage = {
          id: `sentinel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: "assistant",
          content: data.suggestedMessage,
          ts: Date.now(),
          persona,
          companion: true, // pour le rendu compagnon (avatar gauche, pas de feedback buttons)
          sentinel: true,  // pour le style vert-baobab + label "Sentinelle"
          sentinelActions: true, // boutons "J'en parle" / "Je vais bien"
        };
        setMessages((prev) => [...prev, sentinelMsg]);
        sentinelCheckedRef.current = true;
        markSentinelCheckedToday();
      } catch {
        // Échec réseau silencieux — la sentinelle ne doit jamais bloquer le chat.
      }
    },
    [mounted, anonymousId, messages, persona, hasSentinelCheckedToday, markSentinelCheckedToday],
  );

  // Trigger 1 : tous les 5 messages utilisateur.
  // On utilise un ref pour ne pas re-déclencher sur le même count
  // (ex: si l'utilisateur efface un message puis en renvoie un).
  React.useEffect(() => {
    if (!mounted || !anonymousId) return;
    const userMsgCount = messages.filter((m) => m.role === "user").length;
    if (
      userMsgCount > 0 &&
      userMsgCount % 5 === 0 &&
      userMsgCount !== lastSentinelCheckCountRef.current
    ) {
      lastSentinelCheckCountRef.current = userMsgCount;
      void runSentinelCheck();
    }
  }, [messages, mounted, anonymousId, runSentinelCheck]);

  // Trigger 2 : sur focus de l'onglet (visibilitychange → visible).
  // Sankofa "revient" et checke comment tu vas si tu reviens sur l'app
  // après avoir été absent (souvent un signal de pause/hésitation).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void runSentinelCheck();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [runSentinelCheck]);

  /** Dismiss : retire la bulle sentinelle + ack silencieux. */
  const handleSentinelDismiss = React.useCallback((msg: ChatMessage) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  }, []);

  /** Respond : retire la bulle sentinelle + focus l'input avec un hint doux. */
  const handleSentinelRespond = React.useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      // Pré-remplit l'input avec une phrase d'ouverture (l'utilisateur·rice peut éditer).
      setInput("J'ai besoin d'en parler ");
      // Focus sur l'input côté client (dans le prochain tick pour être sûr que le DOM est à jour).
      window.setTimeout(() => {
        inputRef.current?.focus();
        // Place le curseur à la fin du texte pré-rempli.
        const len = inputRef.current?.value.length ?? 0;
        inputRef.current?.setSelectionRange(len, len);
      }, 0);
    },
    [],
  );

  const handlePersonaChange = (p: Persona) => {
    if (p === persona) return;
    setPersona(p);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PERSONA_KEY, p);
      } catch {
        // ignore
      }
    }

    // Si on n'a QUE le message d'accueil → on remplace simplement par le nouveau welcome
    setMessages((prev) => {
      const onlyWelcome =
        prev.length === 1 &&
        typeof prev[0].id === "string" &&
        prev[0].id.startsWith("welcome-");
      if (onlyWelcome) {
        return [buildWelcomeMessage(p)];
      }
      // Sinon : on ajoute un message système annonçant le changement de persona
      const newMeta = PERSONAS.find((x) => x.id === p);
      const switchMsg: ChatMessage = {
        id: `switch-${Date.now()}`,
        role: "assistant",
        content:
          `(Changement de persona — tu parles maintenant à ${newMeta?.name ?? "Aya"}.)`,
        ts: Date.now(),
        persona: p,
      };
      return [...prev, switchMsg];
    });
  };

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping || !anonymousId) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        ts: Date.now(),
      };
      const historyForApi = messages
        .filter((m) => !m.id.startsWith("welcome-") && !m.id.startsWith("switch-"))
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      playSendSound();

      // === Helper : fallback non-streaming vers /api/chat ===
      // Utilisé si /api/chat/stream retourne non-200, tombe en erreur réseau,
      // ou se termine sans aucun token (connexion coupée).
      const fallbackToNonStream = async (): Promise<void> => {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi,
            anonymousId,
            persona,
            userId, // optionnel — null si utilisateur anonyme
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Erreur ${res.status}`);
        }
        const data = (await res.json()) as ChatResponse;
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          ts: Date.now(),
          triageLevel: data.triageLevel,
          tpeActivated: data.tpeActivated,
          protocolUsed: data.protocolUsed,
          persona: data.persona,
          // V3 — transparence + émotion + recommandation de persona
          emotion: data.emotion,
          emotionIntensity: data.emotionIntensity,
          needsEmotionalCheckIn: data.needsEmotionalCheckIn,
          personaRecommendation: data.personaRecommendation,
          protocolsUsed: data.protocolsUsed,
          register: data.register,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        playReceiveSound();

        // === Activation du mode compagnon ===
        // Déclenché par TPE OU red flag — Aya reste avec l'utilisateur·rice
        // pendant son trajet vers la structure.
        if (data.tpeActivated) {
          activateCompanion("tpe", undefined, data.persona);
        } else if (data.redFlagTopic) {
          activateCompanion("red_flag", data.redFlagTopic as RedFlagTopic, data.persona);
        }

        if (data.redFlagTopic) {
          toast.warning("Sujet sensible détecté", {
            description:
              "On t'a orienté·e vers une structure adaptée. Tu n'es pas seul·e.",
          });
        }
        if (data.tpeActivated) {
          toast.info("⏱️ Fenêtre TPE 72h détectée", {
            description: "Sankofa reste avec toi — mode compagnon actif.",
          });
        }
      };

      // === Helper : active le mode compagnon selon le meta reçu du stream ===
      const triggerCompanionFromMeta = (meta: StreamMeta): void => {
        if (meta.tpeActivated) {
          activateCompanion("tpe", undefined, meta.persona);
          toast.info("⏱️ Fenêtre TPE 72h détectée", {
            description: "Sankofa reste avec toi — mode compagnon actif.",
          });
        } else if (meta.redFlagTopic) {
          activateCompanion("red_flag", meta.redFlagTopic, meta.persona);
          toast.warning("Sujet sensible détecté", {
            description:
              "On t'a orienté·e vers une structure adaptée. Tu n'es pas seul·e.",
          });
        }
      };

      try {
        // === Streaming path : POST /api/chat/stream (SSE) ===
        const streamRes = await fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi,
            anonymousId,
            persona,
            userId,
          }),
        });

        // Non-200 ou pas de body → fallback vers /api/chat (non-streaming)
        if (!streamRes.ok || !streamRes.body) {
          console.warn(
            `[Chat] Stream non-200 (status=${streamRes.status}), fallback vers /api/chat`,
          );
          await fallbackToNonStream();
          return;
        }

        // Placeholder assistant message — mis à jour au fur et à mesure des tokens
        const assistantMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant" as const,
            content: "",
            ts: Date.now(),
            persona,
          },
        ]);

        const updateAssistant = (patch: Partial<ChatMessage>): void => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, ...patch } : m,
            ),
          );
        };

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let firstDeltaReceived = false;
        let streamError = false;
        let metaReceived: StreamMeta | null = null;

        // Boucle de lecture SSE — découpe sur double newline (frontière d'événement)
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // garde le chunk incomplet pour le prochain tour

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;

            let data: { type: string; [key: string]: unknown };
            try {
              data = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (data.type === "meta") {
              // Métadonnées envoyées AVANT le stream de tokens
              metaReceived = {
                triageLevel:
                  (data.triageLevel as StreamMeta["triageLevel"]) ?? null,
                persona:
                  (data.persona as Persona) ?? persona,
                register: data.register as StreamMeta["register"],
                emotion: data.emotion as StreamMeta["emotion"],
                emotionIntensity: data.emotionIntensity as number | undefined,
                needsEmotionalCheckIn: data.needsEmotionalCheckIn as
                  | boolean
                  | undefined,
                tpeActivated: data.tpeActivated as boolean | undefined,
                protocolUsed: data.protocolUsed as string | null | undefined,
                protocolsUsed: data.protocolsUsed as string[] | undefined,
                personaRecommendation: data.personaRecommendation as
                  | StreamMeta["personaRecommendation"]
                  | undefined,
                redFlagTopic: data.redFlagTopic as RedFlagTopic | undefined,
              };
              updateAssistant({
                persona: metaReceived.persona,
                triageLevel: metaReceived.triageLevel ?? undefined,
                register: metaReceived.register,
                emotion: metaReceived.emotion,
                emotionIntensity: metaReceived.emotionIntensity,
                needsEmotionalCheckIn: metaReceived.needsEmotionalCheckIn,
                tpeActivated: metaReceived.tpeActivated,
                protocolUsed: metaReceived.protocolUsed ?? undefined,
                protocolsUsed: metaReceived.protocolsUsed,
                personaRecommendation: metaReceived.personaRecommendation,
              });
            } else if (data.type === "delta") {
              // Token增量 — append au contenu de la bulle
              if (!firstDeltaReceived) {
                firstDeltaReceived = true;
                setIsTyping(false); // la bulle elle-même montre le texte qui arrive
                playReceiveSound();
              }
              fullContent += (data.content as string) ?? "";
              updateAssistant({ content: fullContent });
            } else if (data.type === "replace") {
              // Remplace TOUT le contenu (post-check safety a bloqué → fallback)
              if (!firstDeltaReceived) {
                firstDeltaReceived = true;
                setIsTyping(false);
                playReceiveSound();
              }
              fullContent = (data.content as string) ?? "";
              updateAssistant({ content: fullContent });
            } else if (data.type === "done") {
              // Stream terminé — triage final connu
              const finalTriage = data.triageLevel as
                | "info"
                | "orientation"
                | "urgence";
              if (
                typeof data.fullContent === "string" &&
                data.fullContent !== fullContent
              ) {
                fullContent = data.fullContent;
                updateAssistant({ content: fullContent });
              }
              updateAssistant({ triageLevel: finalTriage });

              if (metaReceived) {
                triggerCompanionFromMeta(metaReceived);
              }
            } else if (data.type === "error") {
              // Erreur côté serveur pendant le stream
              streamError = true;
              updateAssistant({
                content: "Désolé, une erreur est survenue. Réessaie.",
              });
            }
          }
        }

        // Si le stream s'est fermé sans aucun token (ni delta, ni error),
        // on retire le placeholder et on bascule vers le fallback non-streaming
        // pour garantir une réponse à l'utilisateur·rice.
        if (!firstDeltaReceived && !streamError) {
          console.warn(
            "[Chat] Stream fermé sans delta, fallback vers /api/chat",
          );
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          await fallbackToNonStream();
        }
      } catch (err) {
        // Erreur réseau ou parse → fallback vers /api/chat (non-streaming)
        console.warn("[Chat] Stream erreur, fallback vers /api/chat:", err);
        try {
          await fallbackToNonStream();
        } catch (err2) {
          const msg =
            err2 instanceof Error ? err2.message : "Erreur inconnue";
          toast.error("Problème de connexion", {
            description: msg + ". Réessaie dans un instant.",
          });
        }
      } finally {
        setIsTyping(false);
        inputRef.current?.focus();
      }
    },
    [anonymousId, isTyping, messages, persona, activateCompanion, userId],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
    // Trigger 360° Y-axis flip on the send button (plane icon does a flip).
    if (!sendFlipping) {
      setSendFlipping(true);
      window.setTimeout(() => setSendFlipping(false), 600);
    }
  };

  const onSuggestion = (s: string) => {
    sendMessage(s);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <section
      id="chat"
      aria-label="Chat avec Sankofa"
      className={cn(
        "w-full h-full flex flex-col overflow-hidden bg-warm-aura",
        className,
      )}
    >
      {/* Photo banner — Abidjan skyline at sunset, with warm gradient overlay.
          .header-blend-bottom softens the bottom edge so the photo blends
          smoothly into the creme-baobab section background (no hard seam). */}
      <div className="header-blend-bottom relative h-[100px] sm:h-[120px] w-full shrink-0 overflow-hidden bg-noir-encre">
        <img
          src="/images/v3/abidjan-sunset.jpg"
          alt="Skyline d'Abidjan au coucher du soleil — pont et immeubles dorés"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />
        {/* Voile chaud terre-brûlée → transparent (lisibilité du texte par-dessus) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(92, 42, 26, 0.85) 0%, rgba(122, 46, 18, 0.55) 45%, rgba(155, 63, 31, 0.25) 80%, rgba(26, 15, 10, 0.10) 100%)",
          }}
        />
        {/* Reflet doré du bas pour fondu avec le header terracotta */}
        <div
          className="absolute inset-x-0 bottom-0 h-8"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(199, 91, 60, 0.35) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 h-full flex flex-col justify-center px-4 sm:px-5">
          <p
            className="text-creme-baobab text-lg sm:text-xl font-bold leading-tight"
            style={{
              fontFamily: "var(--font-bricolage)",
              textShadow: "0 1px 2px rgba(61, 26, 14, 0.35), 0 0 12px rgba(244, 199, 123, 0.25)",
            }}
          >
            Sankofa · Ton aîné·e santé
          </p>
          <p className="trust-badge mt-1 text-creme-baobab">
            100% anonyme · 24/7 · Façonnée à Abidjan 🇨🇮
          </p>
        </div>
      </div>

      {/* Persona selector — single line, no wrap. Glass cream strip. */}
      <div className="shrink-0 px-3 py-1.5 persona-strip-glass">
        <div className="flex items-center gap-1.5 overflow-x-auto aya-scroll whitespace-nowrap">
          <span className="text-xs font-medium text-ocre-rouge shrink-0">Parle à :</span>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePersonaChange(p.id)}
              aria-pressed={persona === p.id}
              title={p.sub}
              className={cn(
                "press shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta",
                persona === p.id
                  ? "bg-terracotta text-creme-baobab border-terracotta shadow-[0_4px_14px_rgba(199,91,60,0.30)]"
                  : "bg-creme-baobab text-ocre-rouge border-ocre-rouge/30 hover:border-terracotta/60",
              )}
            >
              <span className="font-semibold">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Header (premium glassmorphism — terracotta tint + backdrop-blur) */}
      <header className="header-glass flex items-center gap-3 px-4 py-3 text-text-on-dark">
        <PersonaAvatar
          persona={persona}
          size={40}
          priority
          withRing
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold truncate" style={{ fontFamily: "var(--font-bricolage)" }}>
              {PERSONAS.find((p) => p.id === persona)?.name ?? "Aya"}
            </h2>
            {userId ? (
              <Badge className="bg-or-poudre-clair/25 text-text-accent-on-dark border border-or-poudre-clair/40 gap-1 text-[10px]">
                <ShieldCheck className="size-3" />
                Connecté·e
              </Badge>
            ) : (
              <Badge className="bg-or-poudre-clair/15 text-text-accent-on-dark border-0 gap-1 text-[10px]">
                <ShieldCheck className="size-3" />
                Anonyme
              </Badge>
            )}
            <Badge
              className="bg-or-poudre-clair/20 text-text-accent-on-dark border-0 text-[10px] hidden md:inline-flex"
              title="Sankofa parle aussi Dioula et Baoulé en audio (bientôt) — à l'oral, pas à l'écrit"
            >
              FR · Nouchi
            </Badge>
          </div>
          <p className="text-xs text-text-on-dark-soft">
            {isTyping ? "en train d'écrire..." : `${PERSONAS.find((p) => p.id === persona)?.label ?? "Grande sœur"} · en ligne 24/7`}
          </p>
        </div>
        {/* Login button (optional auth — Task 12). Hydration-safe via LoginButton's
            internal "loading" placeholder state. */}
        <div className="shrink-0">
          <LoginButton variant="header" />
        </div>
        <SankofaLogo size={28} className="opacity-80 hidden sm:block" aria-hidden="true" />
      </header>

      {/* Mode compagnon — bannière + actions rapides */}
      {companionMode.active && (
        <div className="px-3 sm:px-4 py-2.5 bg-sable-dore/40 border-b border-ocre-rouge/20 space-y-2">
          <CompanionBanner
            state={companionMode}
            onDismiss={handleDismissCompanion}
          />
          {companionMode.stage !== "completed" &&
            companionMode.stage !== "cancelled" && (
              <CompanionQuickActions
                onAction={handleQuickAction}
                disabled={isTyping}
              />
            )}
        </div>
      )}

      {/* Messages — premium layered background (photo + adinkra + warm glows).
          On welcome state (only the welcome message), a subtle animated
          dots overlay drifts above the background (CSS-only, hydration-safe). */}
      <div
        ref={scrollRef}
        onScroll={onScrollNavToggle}
        className="aya-chat-bg aya-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-4 flex flex-col gap-3 relative"
      >
        {showSuggestions && (
          <div
            className="chat-welcome-dots absolute inset-0 pointer-events-none opacity-60"
            aria-hidden="true"
          />
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              msg={m}
              index={i}
              onSaveToCarnet={onSaveToCarnet}
              anonymousId={anonymousId}
              onSwitchPersona={handlePersonaChange}
              onSentinelDismiss={handleSentinelDismiss}
              onSentinelRespond={handleSentinelRespond}
            />
          ))}
        </AnimatePresence>
        {isTyping && <TypingIndicator persona={persona} />}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <div className="shrink-0 px-3 sm:px-4 py-2 border-t border-ocre-rouge/20 bg-creme-baobab/60 max-h-32 overflow-y-auto aya-scroll">
          <p className="text-xs text-ocre-rouge mb-2.5 font-medium">
            Suggestions pour démarrer 👇
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <CaurisChip
                key={s.label}
                emoji={s.emoji}
                onClick={() => onSuggestion(s.label)}
                disabled={isTyping}
              >
                {s.label}
              </CaurisChip>
            ))}
          </div>
        </div>
      )}

      {/* Input bar — glassmorphism + rounded pill input + focus ring (terracotta 30% glow).
          Fixé en bas, ne défile jamais avec les messages. */}
      <form
        onSubmit={onSubmit}
        className="glass-cream shrink-0 sticky bottom-0 z-20 flex items-center gap-2 px-3 sm:px-4 py-2.5 border-t border-ocre-rouge/15"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isRecording
              ? "Enregistrement en cours... clique sur ⏹ pour transcrire"
              : isTranscribing
                ? "Transcription de l'audio..."
                : "Écris ta question ici..."
          }
          disabled={isTyping || isRecording || isTranscribing}
          maxLength={4000}
          aria-label="Message à envoyer à Sankofa"
          autoComplete="off"
          className="aya-input-glow flex-1 rounded-full bg-creme-baobab border-ocre-rouge/30 focus:border-terracotta transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:ring-terracotta"
        />
        {/* Bouton micro (ASR) — hydratation-safe : désactivé jusqu'au mount côté client.
            Même taille et même forme que le bouton Envoyer (cohérence visuelle).
            Pendant l'enregistrement : fond ocre-rouge + pulse (point rouge visible). */}
        <Button
          type="button"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!mounted || isTyping || isTranscribing}
          aria-label={
            isRecording
              ? "Arrêter l'enregistrement et transcrire"
              : "Parler à Sankofa (micro)"
          }
          aria-pressed={isRecording}
          title={
            isRecording
              ? "Arrêter et transcrire"
              : isTranscribing
                ? "Transcription en cours..."
                : "Parler (entrée vocale)"
          }
          className={cn(
            "aya-btn-press shrink-0",
            isRecording
              ? "bg-ocre-rouge text-text-on-dark animate-pulse ring-2 ring-ocre-rouge/40"
              : "bg-terracotta hover:bg-ocre-rouge text-text-on-dark",
          )}
        >
          {isTranscribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isRecording ? (
            <Square className="size-4 fill-current" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>
        <Button
          type="submit"
          size="icon"
          disabled={isTyping || !input.trim() || isRecording || isTranscribing}
          aria-label="Envoyer le message"
          className={cn(
            "aya-btn-press noise-texture btn-premium shrink-0 text-creme-baobab overflow-hidden",
            sendFlipping && "send-success",
          )}
        >
          {isTyping ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </section>
  );
}

export default Chat;
