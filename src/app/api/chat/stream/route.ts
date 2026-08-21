/**
 * POST /api/chat/stream (V3 — Streaming LLM)
 *
 * Body: {
 *   message: string,
 *   history: {role, content}[],
 *   anonymousId: string,
 *   persona?: Persona,
 *   userId?: string | null,
 * }
 *
 * Response: Server-Sent Events (text/event-stream)
 *   - data: {"type":"meta","triageLevel":...,"persona":...,"emotion":...,"personaRecommendation":...,"protocolsUsed":...,"tpeActivated":...}
 *   - data: {"type":"delta","content":"token..."}
 *   - data: {"type":"done","fullContent":"...","triageLevel":...}
 *   - data: {"type":"error","message":"..."}
 *
 * Red flags → réponse pré-écrite immédiate (pas de stream, sécurité).
 * Sinon : stream les tokens LLM, post-check safety sur le contenu final,
 * si bloqué → remplace par fallback à la fin.
 */

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
  generateChatResponseStream,
  buildSystemPrompt,
  PERSONA_VARIANTS,
  type LLMMessage,
} from "@/lib/llm";
import { analyzeEmotion, getEmpathyPrefix } from "@/lib/emotion";
import { recommendPersona } from "@/lib/persona-suggest";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface StreamRequestBody {
  message?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  anonymousId?: string;
  persona?: Persona;
  userId?: string | null;
}

function estimateTriageLevel(
  message: string,
  tpeActivated: boolean,
): TriageLevel {
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
        ...(validUserId ? { userId: validUserId } : {}),
      },
    });

    await db.message.create({
      data: { conversationId: conversation.id, role: "user", content: userMessage },
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
    console.error("[Sankofa stream] Persistance échouée:", err);
  }
}

export async function POST(req: Request) {
  let body: StreamRequestBody;
  try {
    body = (await req.json()) as StreamRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = (body.message ?? "").trim();
  const anonymousId = (body.anonymousId ?? "").trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const persona: Persona =
    body.persona === "grande_soeur" ||
    body.persona === "grand_frere" ||
    body.persona === "tonton_medecin"
      ? body.persona
      : "grande_soeur";
  const userId = (body.userId ?? null)?.trim() || null;

  if (!message || !anonymousId || message.length > 4000) {
    return new Response(
      JSON.stringify({ error: "Paramètres invalides." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // === ÉTAPE 1 : Red flag → réponse pré-écrite (pas de stream) ===
        const redFlag = detectRedFlag(message);
        if (redFlag) {
          const userLang = detectUserRegister(message);
          const greeting = getLocalizedGreeting(userLang);
          const fullResponse = greeting ? greeting + redFlag.response : redFlag.response;

          send({
            type: "meta",
            triageLevel: "urgence" as TriageLevel,
            persona,
            personaName: PERSONA_VARIANTS[persona].name,
            personaLabel: PERSONA_VARIANTS[persona].label,
            register: redFlag.register,
            userRegister: userLang,
            emotion: "détresse",
            emotionIntensity: 1,
            needsEmotionalCheckIn: true,
            tpeActivated: false,
            protocolUsed: null,
            protocolsUsed: [],
            redFlagTopic: redFlag.topic as RedFlagTopic,
            personaRecommendation: { recommended: persona, current: persona, shouldSuggest: false, reason: "" },
          });
          send({ type: "delta", content: fullResponse });
          send({ type: "done", fullContent: fullResponse, triageLevel: "urgence" });

          await persistConversation(anonymousId, message, fullResponse, "urgence", false, null, userId);
          controller.close();
          return;
        }

        // === ÉTAPE 2 : TPE + émotion + persona + RAG (même pipeline que non-stream) ===
        const tpeInfo = detectTPE(message);
        const emotionResult = analyzeEmotion(message);
        const personaRec = recommendPersona(message, persona);

        let docs = await retrieveProtocolsSemantic(message, 3);
        if (docs.length === 0) docs = retrieveProtocols(message, 3);
        if (tpeInfo.activated && !docs.some((d) => d.slug === "tpe-vih")) {
          docs.push(...retrieveProtocols("tpe vih rapport exposition", 1));
        }
        const retrievedFormatted = formatRetrievedProtocols(docs);
        const protocolUsed = docs[0]?.slug ?? null;
        const protocolsUsed = docs.map((d) => d.slug).filter(Boolean) as string[];

        const userRegister = detectUserRegister(message);
        const systemPrompt = buildSystemPrompt(persona, userRegister, retrievedFormatted);

        const llmMessages: LLMMessage[] = history.slice(-10).map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));
        llmMessages.push({ role: "user", content: message });

        // Envoi du meta AVANT le stream
        send({
          type: "meta",
          triageLevel: null, // sera déterminé à la fin
          persona,
          personaName: PERSONA_VARIANTS[persona].name,
          personaLabel: PERSONA_VARIANTS[persona].label,
          register: userRegister,
          userRegister,
          emotion: emotionResult.emotion,
          emotionIntensity: emotionResult.intensity,
          needsEmotionalCheckIn: emotionResult.needsCheckIn,
          tpeActivated: tpeInfo.activated,
          protocolUsed,
          protocolsUsed,
          personaRecommendation: personaRec,
        });

        // === ÉTAPE 3 : Stream des tokens ===
        const empathyPrefix = getEmpathyPrefix(emotionResult.emotion, emotionResult.intensity);
        if (empathyPrefix) {
          send({ type: "delta", content: empathyPrefix });
        }

        let accumulated = empathyPrefix;
        let finalReply: string;

        // Essayer d'abord le streaming natif (génère tokens un par un)
        let receivedAny = false;
        try {
          for await (const delta of generateChatResponseStream(systemPrompt, llmMessages)) {
            receivedAny = true;
            accumulated += delta;
            send({ type: "delta", content: delta });
          }
        } catch (streamErr) {
          console.warn("[Sankofa stream] Streaming natif échoué, fallback non-stream:", streamErr);
        }

        // Si le streaming n'a rien produit → fallback sur generateChatResponse (non-streaming)
        if (!receivedAny) {
          console.log("[Sankofa stream] Pas de tokens reçus, utilisation generateChatResponse (non-streaming)");
          const { reply, ok } = await generateChatResponse(systemPrompt, llmMessages);
          if (ok) {
            accumulated = empathyPrefix ? empathyPrefix + reply : reply;
            send({ type: "delta", content: reply });
            receivedAny = true;
          }
        }

        // === ÉTAPE 4 : Post-check safety + fallback ===
        if (!receivedAny) {
          finalReply = getFallbackResponse();
          send({ type: "replace", content: finalReply });
        } else if (!checkOutputSafety(accumulated)) {
          console.warn("[Sankofa stream] Réponse bloquée par post-check (motif interdit).");
          finalReply = getFallbackResponse();
          send({ type: "replace", content: finalReply });
        } else {
          finalReply = accumulated;
        }

        const triageLevel = estimateTriageLevel(message, tpeInfo.activated);
        send({ type: "done", fullContent: finalReply, triageLevel });

        // === ÉTAPE 5 : Persistance ===
        await persistConversation(anonymousId, message, finalReply, triageLevel, tpeInfo.activated, protocolUsed, userId);
      } catch (err) {
        console.error("[Sankofa stream] Error:", err);
        send({ type: "error", message: "Une erreur est survenue. Réessaie." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
