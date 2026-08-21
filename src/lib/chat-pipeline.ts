/**
 * Shared Sankofa chat pipeline.
 *
 * Ce module contient toute la logique de traitement d'un message utilisateur :
 *   1. Red flag detection → réponse pré-écrite (registre sober)
 *   2. TPE detection (rapport + indication temporelle dans 72h)
 *   3. RAG retrieval (TF-IDF + fuzzy + semantic si embeddings dispo)
 *   4. Build du system prompt (persona + registre détecté)
 *   5. Appel LLM via z-ai-web-dev-sdk
 *   6. Post-check safety
 *   7. Persistance Prisma (Conversation + Message)
 *
 * Utilisé par :
 *   - `/api/chat`            (frontend web Sankofa)
 *   - `/api/whatsapp/webhook` (incoming WhatsApp messages)
 *
 * Si tu ajoutes un nouveau canal (Telegram, SMS, …), importe `processChatMessage()`.
 */

import { db } from "@/lib/db";
import {
  detectRedFlag,
  detectUserRegister,
  checkOutputSafety,
  getFallbackResponse,
  getLocalizedGreeting,
  normalizeForDetection,
  TRIAGE_KEYWORDS,
  type TriageLevel,
  type Persona,
  type ToneRegister,
  type UserRegister,
  type RedFlagTopic,
} from "@/lib/guardrails";
import {
  retrieveProtocols,
  retrieveProtocolsSemantic,
  formatRetrievedProtocols,
  detectTPE,
} from "@/lib/rag";
import {
  generateChatResponse,
  buildSystemPrompt,
  PERSONA_VARIANTS,
  type LLMMessage,
} from "@/lib/llm";
import { analyzeEmotion, getEmpathyPrefix, type Emotion } from "@/lib/emotion";
import { recommendPersona, type PersonaRecommendation } from "@/lib/persona-suggest";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProcessChatInput {
  message: string;
  history?: ChatHistoryMessage[];
  anonymousId: string;
  persona?: Persona;
  /** Optionnel (Task 12) — lie la conversation à un User authentifié. Null = anonyme. */
  userId?: string | null;
}

export interface ProcessChatOutput {
  reply: string;
  triageLevel: TriageLevel;
  tpeActivated: boolean;
  protocolUsed: string | null;
  redFlagTopic?: RedFlagTopic;
  persona: Persona;
  personaName: string;
  personaLabel: string;
  register: ToneRegister;
  userRegister: UserRegister;
  /** Émotion détectée dans le message utilisateur (V3 — transparence + empathy). */
  emotion?: Emotion;
  /** Score d'intensité émotionnelle 0-1. */
  emotionIntensity?: number;
  /** True si Sankofa suggère un check-in émotionnel (détresse haute). */
  needsEmotionalCheckIn?: boolean;
  /** Recommandation de persona (V3 — switch intelligent). */
  personaRecommendation?: PersonaRecommendation;
  /** Slugs des protocoles RAG utilisés (V3 — transparence). */
  protocolsUsed?: string[];
}

const VALID_PERSONAS: Persona[] = [
  "grande_soeur",
  "grand_frere",
  "tonton_medecin",
];

function estimateTriageLevel(
  message: string,
  isRedFlag: boolean,
  tpeActivated: boolean,
): TriageLevel {
  if (isRedFlag) return "urgence";
  const normalized = normalizeForDetection(message);
  for (const kw of TRIAGE_KEYWORDS.urgence) {
    if (normalized.includes(normalizeForDetection(kw))) return "urgence";
  }
  if (tpeActivated) return "orientation";
  for (const kw of TRIAGE_KEYWORDS.orientation) {
    if (normalized.includes(normalizeForDetection(kw))) return "orientation";
  }
  return "info";
}

async function persistConversation(
  anonymousId: string,
  userMessage: string,
  assistantReply: string,
  triageLevel: TriageLevel,
  tpeActivated: boolean,
  protocolUsed: string | null,
  userId?: string | null,
): Promise<void> {
  try {
    // Si userId fourni, on vérifie qu'il existe en DB avant de lier (defensif —
    // un userId invalide ne doit pas casser la persistance anonyme).
    let validUserId: string | null = null;
    if (userId) {
      const exists = await db.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (exists) validUserId = userId;
    }

    const conversation = await db.conversation.upsert({
      where: { anonymousId },
      create: { anonymousId, userId: validUserId },
      update: {
        updatedAt: new Date(),
        // Si la conversation existait déjà anonyme et que l'utilisateur s'authentifie
        // maintenant, on lie rétroactivement la conversation au User.
        ...(validUserId ? { userId: validUserId } : {}),
      },
    });

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userMessage,
      },
    });

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: assistantReply,
        triageLevel,
        protocolUsed,
        tpeActivated,
      },
    });
  } catch (err) {
    console.error("[Sankofa chat] Persistance échouée:", err);
  }
}

/**
 * Traite un message utilisateur via le pipeline Sankofa complet.
 *
 * @param input.message      Texte envoyé par l'utilisateur·rice
 * @param input.history      Historique récent (sera tronqué aux 10 derniers)
 * @param input.anonymousId  ID anonyme (UUID client) — doit être non vide
 * @param input.persona      Persona Sankofa (default: grande_soeur)
 */
export async function processChatMessage(
  input: ProcessChatInput,
): Promise<ProcessChatOutput> {
  const message = (input.message ?? "").trim();
  const history = Array.isArray(input.history) ? input.history : [];
  const anonymousId = (input.anonymousId ?? "").trim();
  const persona: Persona = VALID_PERSONAS.includes(input.persona as Persona)
    ? (input.persona as Persona)
    : "grande_soeur";
  const userId = input.userId ?? null;

  // === ÉTAPE 1 : Red flag detection ===
  const redFlag = detectRedFlag(message);
  if (redFlag) {
    const userLang = detectUserRegister(message);
    const localizedGreeting = getLocalizedGreeting(userLang);
    const localizedResponse = localizedGreeting
      ? localizedGreeting + redFlag.response
      : redFlag.response;

    console.log(
      `[Sankofa chat] RED FLAG: ${redFlag.topic} · registre=${redFlag.register} · persona=${persona} · userLang=${userLang} (pas d'appel LLM)`,
    );
    await persistConversation(
      anonymousId,
      message,
      localizedResponse,
      "urgence",
      false,
      null,
      userId,
    );
    return {
      reply: localizedResponse,
      triageLevel: "urgence",
      tpeActivated: false,
      protocolUsed: null,
      redFlagTopic: redFlag.topic,
      persona,
      personaName: PERSONA_VARIANTS[persona].name,
      personaLabel: PERSONA_VARIANTS[persona].label,
      register: redFlag.register,
      userRegister: userLang,
      emotion: "détresse" as Emotion,
      emotionIntensity: 1,
      needsEmotionalCheckIn: true,
    };
  }

  // === ÉTAPE 2 : TPE detection ===
  const tpeInfo = detectTPE(message);

  // === ÉTAPE 2.5 : Détection émotionnelle + recommandation persona (V3) ===
  const emotionResult = analyzeEmotion(message);
  const personaRec = recommendPersona(message, persona);

  // === ÉTAPE 3 : RAG retrieval ===
  // On essaie d'abord la recherche sémantique (embeddings) si elle est dispo.
  // Sinon on retombe sur le TF-IDF + fuzzy classique (toujours dispo).
  let docs = await retrieveProtocolsSemantic(message, 3);
  if (docs.length === 0) {
    docs = retrieveProtocols(message, 3);
  }
  if (tpeInfo.activated && !docs.some((d) => d.slug === "tpe-vih")) {
    const all = retrieveProtocols("tpe vih rapport exposition", 1);
    docs.push(...all);
  }
  const retrievedFormatted = formatRetrievedProtocols(docs);
  const protocolUsed = docs[0]?.slug ?? null;
  const protocolsUsed = docs.map((d) => d.slug).filter(Boolean) as string[];

  // === ÉTAPE 4 : Détection du registre utilisateur + build du prompt ===
  const userRegister = detectUserRegister(message);
  const systemPrompt = buildSystemPrompt(
    persona,
    userRegister,
    retrievedFormatted,
  );

  // === ÉTAPE 5 : Appel LLM ===
  const llmMessages: LLMMessage[] = history
    .slice(-10)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));
  llmMessages.push({ role: "user", content: message });

  const { reply, ok } = await generateChatResponse(systemPrompt, llmMessages);

  let finalReply: string;
  if (!ok) {
    finalReply = getFallbackResponse();
  } else {
    // === ÉTAPE 6 : Post-check safety ===
    if (!checkOutputSafety(reply)) {
      console.warn(
        "[Sankofa chat] Réponse LLM bloquée par post-check (motif interdit).",
      );
      finalReply = getFallbackResponse();
    } else {
      // Préfixer avec l'empathie émotionnelle si une émotion forte est détectée
      // (sauf si la réponse LLM commence déjà par un ack empathique)
      const empathyPrefix = getEmpathyPrefix(emotionResult.emotion, emotionResult.intensity);
      finalReply = empathyPrefix
        ? empathyPrefix + reply
        : reply;
    }
  }

  // === ÉTAPE 7 : Persistance ===
  const triageLevel = estimateTriageLevel(message, false, tpeInfo.activated);
  await persistConversation(
    anonymousId,
    message,
    finalReply,
    triageLevel,
    tpeInfo.activated,
    protocolUsed,
    userId,
  );

  return {
    reply: finalReply,
    triageLevel,
    tpeActivated: tpeInfo.activated,
    protocolUsed,
    persona,
    personaName: PERSONA_VARIANTS[persona].name,
    personaLabel: PERSONA_VARIANTS[persona].label,
    register: userRegister,
    userRegister,
    emotion: emotionResult.emotion,
    emotionIntensity: emotionResult.intensity,
    needsEmotionalCheckIn: emotionResult.needsCheckIn,
    personaRecommendation: personaRec,
    protocolsUsed,
  };
}
