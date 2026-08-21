/**
 * GET /api/admin/stats
 *
 * Statistiques agrégées pour le dashboard admin (lecture seule).
 * Retourne :
 *   - totalConversations (Conversation count)
 *   - totalMessages (Message count)
 *   - redFlagsTriggered (proxy : messages assistant avec triageLevel='urgence')
 *   - tpeActivations (messages avec tpeActivated=true)
 *   - paymentsInitiated (PaymentTransaction count + total amount + par tier/status)
 *   - activeCompanionModes (proxy : conversations avec TPE ou urgence dans la dernière heure)
 *   - triageBreakdown (répartition info / orientation / urgence)
 *
 * ⚠️ MVP — PAS D'AUTH sur cette route. En production :
 *   - Protéger par NextAuth + rôle admin (ex: ADMIN_EMAILS allowlist)
 *   - Ajouter rate-limiting (ex: Upstash)
 *   - Logs d'audit des accès admin
 *   - Chiffrer les anonymousId côté sortie (hachage SHA-256 + sel)
 *
 * Note sur les "red flags" :
 *   Le topic exact (viol, suicide, etc.) n'est PAS persisté en DB (privacy by design).
 *   On utilise donc le proxy triageLevel='urgence' (red flags + urgence-keyword match).
 *   Le topic est re-détecté à la volée dans /api/admin/conversations via detectRedFlag().
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
// Stats frais — pas de cache navigateur
export const dynamic = 'force-dynamic';

interface PaymentByStatus {
  pending: number;
  success: number;
  failed: number;
  totalAmount: number;
}
interface PaymentBreakdown {
  plan_action: PaymentByStatus;
  teleconsultation: PaymentByStatus;
  total: number;
}

export async function GET() {
  try {
    const [
      totalConversations,
      totalMessages,
      urgenceMessages,
      tpeMessages,
      payments,
      recentActivations,
      triageBreakdown,
    ] = await Promise.all([
      db.conversation.count(),
      db.message.count(),
      db.message.count({
        where: {
          role: 'assistant',
          triageLevel: 'urgence',
        },
      }),
      db.message.count({
        where: { tpeActivated: true },
      }),
      db.paymentTransaction.findMany({
        select: { tier: true, status: true, amount: true },
      }),
      // Activations "récentes" (proxy companion actif) = conversations
      // ayant eu un message urgence ou TPE dans les 60 dernières minutes
      db.message.findMany({
        where: {
          OR: [
            { triageLevel: 'urgence' },
            { tpeActivated: true },
          ],
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { conversationId: true },
        distinct: ['conversationId'],
      }),
      db.message.groupBy({
        by: ['triageLevel'],
        where: { role: 'assistant' },
        _count: { _all: true },
      }),
    ]);

    // Build payments breakdown
    const breakdown: PaymentBreakdown = {
      plan_action: { pending: 0, success: 0, failed: 0, totalAmount: 0 },
      teleconsultation: { pending: 0, success: 0, failed: 0, totalAmount: 0 },
      total: payments.length,
    };
    for (const p of payments) {
      const slot = p.tier === 'plan_action' ? breakdown.plan_action : breakdown.teleconsultation;
      if (p.status === 'pending' || p.status === 'success' || p.status === 'failed') {
        slot[p.status] += 1;
      }
      slot.totalAmount += p.amount;
    }

    // Build triage breakdown map
    const triageMap: Record<string, number> = {
      info: 0,
      orientation: 0,
      urgence: 0,
      null: 0,
    };
    for (const row of triageBreakdown) {
      const key = row.triageLevel ?? 'null';
      triageMap[key] = row._count._all;
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals: {
        conversations: totalConversations,
        messages: totalMessages,
        redFlagsTriggered: urgenceMessages,
        tpeActivations: tpeMessages,
        paymentsInitiated: payments.length,
        activeCompanionModes: recentActivations.length,
      },
      payments: breakdown,
      triageBreakdown: triageMap,
      // Le mode compagnon est client-side (localStorage). On expose un proxy :
      // conversations ayant déclenché TPE ou urgence → companion auto-activé.
      companionNote:
        'Le mode compagnon est stocké côté client (localStorage, privacy by design). ' +
        'Le compteur "activeCompanionModes" est un proxy : conversations avec TPE ou urgence dans la dernière heure.',
    });
  } catch (err) {
    console.error('[/api/admin/stats] Erreur:', err);
    return NextResponse.json(
      { error: 'Impossible de calculer les statistiques.' },
      { status: 500 },
    );
  }
}
