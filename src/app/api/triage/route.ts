/**
 * POST /api/triage
 *
 * Body: { message: string }
 * Response: { level: 'info'|'orientation'|'urgence', reasons: string[], tpeActivated: boolean, estimatedHours?: number }
 *
 * Triage simplifié basé sur mots-clés + détection temporelle.
 * Utilisé côté UI pour prévisualiser le niveau avant l'envoi complet.
 */

import { NextResponse } from 'next/server';
import {
  detectRedFlag,
  normalizeForDetection,
  TRIAGE_KEYWORDS,
  type TriageLevel,
} from '@/lib/guardrails';
import { detectTPE } from '@/lib/rag';

export const runtime = 'nodejs';

interface TriageRequestBody {
  message?: string;
}

export async function POST(req: Request) {
  let body: TriageRequestBody;
  try {
    body = (await req.json()) as TriageRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide (JSON attendu).' },
      { status: 400 },
    );
  }

  const message = (body.message ?? '').trim();
  if (!message) {
    return NextResponse.json(
      { error: 'Le paramètre "message" est requis.' },
      { status: 400 },
    );
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: 'Message trop long (max 4000 caractères).' },
      { status: 413 },
    );
  }

  const reasons: string[] = [];

  // 1. Red flags → urgence vitale
  const redFlag = detectRedFlag(message);
  if (redFlag) {
    return NextResponse.json({
      level: 'urgence' as TriageLevel,
      reasons: [`Red flag détecté : ${redFlag.topic}`],
      tpeActivated: false,
    });
  }

  // 2. TPE detection
  const tpe = detectTPE(message);
  if (tpe.activated) {
    reasons.push(
      tpe.estimatedHours
        ? `Rapport à risque récent détecté (~${tpe.estimatedHours}h) → TPE possible dans les 72h`
        : 'Rapport à risque détecté → évaluer la fenêtre TPE 72h',
    );
  }

  // 3. Keywords
  const normalized = normalizeForDetection(message);
  const matchedUrgence: string[] = [];
  const matchedOrientation: string[] = [];
  for (const kw of TRIAGE_KEYWORDS.urgence) {
    if (normalized.includes(normalizeForDetection(kw))) matchedUrgence.push(kw);
  }
  for (const kw of TRIAGE_KEYWORDS.orientation) {
    if (normalized.includes(normalizeForDetection(kw))) matchedOrientation.push(kw);
  }

  let level: TriageLevel = 'info';
  if (matchedUrgence.length > 0) {
    level = 'urgence';
    reasons.push(`Symptômes évocateurs : ${matchedUrgence.join(', ')}`);
  } else if (tpe.activated || matchedOrientation.length > 0) {
    level = 'orientation';
    if (matchedOrientation.length > 0) {
      reasons.push(`Thème santé sexuelle : ${matchedOrientation.slice(0, 3).join(', ')}`);
    }
  } else {
    reasons.push('Question d\'information générale');
  }

  return NextResponse.json({
    level,
    reasons,
    tpeActivated: tpe.activated,
    estimatedHours: tpe.estimatedHours,
  });
}
