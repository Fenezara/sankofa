/**
 * POST /api/chat/feedback
 *
 * Body: {
 *   anonymousId: string,
 *   messageTs: number,        // timestamp du message concerné
 *   messageRole: 'user' | 'assistant',
 *   messagePreview: string,   // 100 premiers chars max
 *   thumb: 'up' | 'down',
 *   comment?: string,
 *   triageLevel?: 'info' | 'orientation' | 'urgence',
 *   persona?: 'grande_soeur' | 'grand_frere' | 'tonton_medecin',
 *   emotion?: string,
 * }
 *
 * Persiste le feedback utilisateur (👍/👎) pour la boucle d'apprentissage.
 * Privacy-safe : anonymousId seulement, aucune PII.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

interface FeedbackRequestBody {
  anonymousId?: string;
  messageTs?: number;
  messageRole?: string;
  messagePreview?: string;
  thumb?: string;
  comment?: string;
  triageLevel?: string;
  persona?: string;
  emotion?: string;
}

export async function POST(req: Request) {
  let body: FeedbackRequestBody;
  try {
    body = (await req.json()) as FeedbackRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide (JSON attendu).' },
      { status: 400 },
    );
  }

  const anonymousId = (body.anonymousId ?? '').trim();
  const thumb = body.thumb === 'up' || body.thumb === 'down' ? body.thumb : null;

  if (!anonymousId) {
    return NextResponse.json(
      { error: 'anonymousId est requis.' },
      { status: 400 },
    );
  }
  if (!thumb) {
    return NextResponse.json(
      { error: 'thumb doit être "up" ou "down".' },
      { status: 400 },
    );
  }
  if (!body.messageTs || typeof body.messageTs !== 'number') {
    return NextResponse.json(
      { error: 'messageTs (number) est requis.' },
      { status: 400 },
    );
  }

  const messagePreview = (body.messagePreview ?? '').slice(0, 100);
  const comment = body.comment ? body.comment.slice(0, 500) : null;
  const messageRole = body.messageRole === 'user' || body.messageRole === 'assistant'
    ? body.messageRole
    : 'assistant';

  try {
    await db.feedback.create({
      data: {
        anonymousId,
        messageRole,
        messageTs: body.messageTs,
        messagePreview,
        thumb,
        comment,
        triageLevel: body.triageLevel ?? null,
        persona: body.persona ?? null,
        emotion: body.emotion ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Sankofa feedback] DB error:', err);
    return NextResponse.json(
      { error: 'Erreur de persistance.' },
      { status: 500 },
    );
  }
}
