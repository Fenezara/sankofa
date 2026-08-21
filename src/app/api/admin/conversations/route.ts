/**
 * GET /api/admin/conversations
 *
 * Retourne les 20 dernières conversations avec leurs messages (last 20 convs),
 * un log des 10 derniers red flags, 10 dernières transactions, et 5 dernières
 * activations du mode compagnon (proxy : conversations avec TPE/urgence).
 *
 * Toutes les données sont anonymisées (anonymousId haché SHA-256 + sel court,
 * jamais l'UUID brut).
 *
 * ⚠️ MVP — PAS D'AUTH. En production : NextAuth + rôle admin + rate-limit.
 *
 * Response shape:
 *  {
 *    conversations: [{
 *      anonymousIdHash, messageCount, lastMessagePreview, triageLevel, updatedAt,
 *      createdAt
 *    }],
 *    redFlagLog: [{ topic, timestamp, anonymousIdHash, preview }],
 *    paymentLog: [{ tier, amount, status, timestamp, anonymousIdHash }],
 *    companionLog: [{ trigger, startedAt, anonymousIdHash, stage }]
 *  }
 */

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { detectRedFlag, type RedFlagTopic } from '@/lib/guardrails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sel court statique pour le hachage — évite ré-identifiabilité croisée entre
// dumps admin. En prod : sel par-session stocké côté serveur.
const HASH_SALT = 'aya-admin-v1';

function hashAnonymousId(anonymousId: string): string {
  return createHash('sha256')
    .update(HASH_SALT + anonymousId)
    .digest('hex')
    .slice(0, 12);
}

function truncatePreview(s: string, n = 80): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

function highestTriage(levels: string[]): string {
  if (levels.includes('urgence')) return 'urgence';
  if (levels.includes('orientation')) return 'orientation';
  if (levels.includes('info')) return 'info';
  return 'info';
}

function estimateCompanionStage(lastMessageAt: Date): 'active' | 'completed' {
  // Companion auto-annule après 5 check-ins × 45s = ~3min45 sans réponse (démo).
  // Au-delà de 10 min sans message, on considère la session "terminée".
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  return lastMessageAt.getTime() >= tenMinAgo ? 'active' : 'completed';
}

export async function GET() {
  try {
    // === 20 dernières conversations ===
    const recentConversations = await db.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 30, // derniers messages de chaque conv (pour preview + triage)
          select: {
            role: true,
            content: true,
            triageLevel: true,
            tpeActivated: true,
            createdAt: true,
          },
        },
      },
    });

    const conversations = recentConversations.map((c) => {
      const lastAssistant = c.messages.find((m) => m.role === 'assistant');
      const lastUser = c.messages.find((m) => m.role === 'user');
      const preview = lastUser?.content ?? lastAssistant?.content ?? '(vide)';
      const triageLevels = c.messages
        .map((m) => m.triageLevel)
        .filter((l): l is string => l !== null && l !== undefined);
      return {
        anonymousIdHash: hashAnonymousId(c.anonymousId),
        messageCount: c.messages.length,
        lastMessagePreview: truncatePreview(preview),
        triageLevel: highestTriage(triageLevels),
        updatedAt: c.updatedAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      };
    });

    // === Red flag log (10 derniers) ===
    // On récupère les 50 derniers messages assistant 'urgence' avec le message
    // utilisateur précédent, puis on re-détecte le topic à la volée.
    const urgenceMessages = await db.message.findMany({
      where: { role: 'assistant', triageLevel: 'urgence' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        conversation: {
          select: { anonymousId: true },
        },
      },
    });

    // Pour chaque message urgence, on récupère le message utilisateur précédent
    // (même conversation, juste avant dans le temps) afin de re-détecter le topic.
    const redFlagLog: Array<{
      topic: RedFlagTopic | 'urgence_keyword';
      timestamp: string;
      anonymousIdHash: string;
      preview: string;
    }> = [];

    for (const m of urgenceMessages) {
      if (redFlagLog.length >= 10) break;
      // Message utilisateur précédent dans la même conversation
      const prevUser = await db.message.findFirst({
        where: {
          conversationId: m.conversationId,
          role: 'user',
          createdAt: { lt: m.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      });
      const userMsg = prevUser?.content ?? '';
      const detected = detectRedFlag(userMsg);
      redFlagLog.push({
        topic: detected ? detected.topic : 'urgence_keyword',
        timestamp: m.createdAt.toISOString(),
        anonymousIdHash: hashAnonymousId(m.conversation.anonymousId),
        preview: truncatePreview(userMsg, 60),
      });
    }

    // === Payment log (10 derniers) ===
    const recentPayments = await db.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        tier: true,
        amount: true,
        status: true,
        createdAt: true,
        anonymousId: true,
      },
    });
    const paymentLog = recentPayments.map((p) => ({
      tier: p.tier,
      amount: p.amount,
      status: p.status,
      timestamp: p.createdAt.toISOString(),
      anonymousIdHash: hashAnonymousId(p.anonymousId),
    }));

    // === Companion log (5 derniers, proxy) ===
    // Conversations avec au moins un message TPE ou urgence (auto-activation du mode compagnon).
    const companionTriggers = await db.message.findMany({
      where: {
        OR: [
          { tpeActivated: true },
          { triageLevel: 'urgence' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        createdAt: true,
        tpeActivated: true,
        triageLevel: true,
        conversationId: true,
        conversation: { select: { anonymousId: true, updatedAt: true } },
      },
    });
    // Déduplique par conversationId (la première occurrence = la plus récente)
    const seenConv = new Set<string>();
    const companionLog: Array<{
      trigger: 'tpe' | 'red_flag';
      startedAt: string;
      anonymousIdHash: string;
      stage: 'active' | 'completed';
    }> = [];
    for (const t of companionTriggers) {
      if (seenConv.has(t.conversationId)) continue;
      seenConv.add(t.conversationId);
      if (companionLog.length >= 5) break;
      const trigger: 'tpe' | 'red_flag' = t.tpeActivated ? 'tpe' : 'red_flag';
      companionLog.push({
        trigger,
        startedAt: t.createdAt.toISOString(),
        anonymousIdHash: hashAnonymousId(t.conversation.anonymousId),
        stage: estimateCompanionStage(t.conversation.updatedAt),
      });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      conversations,
      redFlagLog,
      paymentLog,
      companionLog,
    });
  } catch (err) {
    console.error('[/api/admin/conversations] Erreur:', err);
    return NextResponse.json(
      { error: 'Impossible de récupérer les conversations.' },
      { status: 500 },
    );
  }
}
