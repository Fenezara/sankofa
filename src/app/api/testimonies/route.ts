/**
 * GET /api/testimonies
 * POST /api/testimonies
 *
 * Témoignages anonymes modérés (Innovation — Pair-Aidant Lite).
 * Renforce le message "Tu n'es pas seul·e".
 *
 * GET — liste des témoignages approuvés (status="approved")
 *   Query:
 *     ?domain=SSR         — filtre par domaine (SSR | Addictologie | Dermatologie | Santé mentale | Nutrition)
 *     ?limit=20           — pagination (défaut 20, max 50)
 *     ?offset=0           — offset pour "Voir plus" / infinite scroll
 *   Response: {
 *     testimonies: Testimony[],
 *     total: number,
 *     hasMore: boolean
 *   }
 *
 * POST — soumet un nouveau témoignage (status="pending" par défaut)
 *   Body: {
 *     anonymousId: string,
 *     domain: 'SSR' | 'Addictologie' | 'Dermatologie' | 'Santé mentale' | 'Nutrition',
 *     title: string,    // ≤ 100 chars
 *     content: string,  // ≤ 1000 chars
 *     ageRange?: '15-17' | '18-19' | '20-24'
 *   }
 *   Response: 201 { id, status: 'pending', moderationMessage }
 *
 * Privacy by design :
 *   - anonymousId seulement (jamais d'identité réelle)
 *   - modération obligatoire avant publication (24-48h)
 *   - aucun cookie / IP stockée
 *
 * Charte (vérification backend légère — modération humaine pour le reste) :
 *   - Pas de PII évidente (regex téléphone / email)
 *   - Pas d'apologie de l'automutilation (mots-clés)
 *   - Longueur titre ≤ 100, contenu ≤ 1000
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const VALID_DOMAINS = [
  "SSR",
  "Addictologie",
  "Dermatologie",
  "Santé mentale",
  "Nutrition",
] as const;

const VALID_AGE_RANGES = ["15-17", "18-19", "20-24"] as const;

const MODERATION_MESSAGE =
  "Ton témoignage sera relu sous 24-48h par notre équipe. On vérifie juste qu'il respecte la charte (pas de conseils médicaux, pas de haine, pas de PII).";

const TITLE_MAX = 100;
const CONTENT_MAX = 1000;

// Patterns suspects (vérification légère côté backend — la modération humaine reste finale)
const PII_PATTERNS = [
  /\+?\d[\d\s.-]{8,}\d/, // numéros de téléphone (10+ chiffres)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // emails
];

const SELF_HARM_PATTERNS = [
  /suicid/i,
  /tuer\b/i,
  /m['e ]?touer/i,
  /automutil/i,
  /me\s+(?:blesser|couper)/i,
];

interface TestimonyRequestBody {
  anonymousId?: string;
  domain?: string;
  title?: string;
  content?: string;
  ageRange?: string;
}

/** Valide + nettoie un témoignage avant insertion. */
function validateTestimony(body: TestimonyRequestBody): {
  ok: boolean;
  error?: string;
  data?: {
    anonymousId: string;
    domain: string;
    title: string;
    content: string;
    ageRange: string | null;
  };
} {
  const anonymousId = (body.anonymousId ?? "").trim();
  if (!anonymousId || anonymousId.length > 100) {
    return { ok: false, error: "anonymousId invalide." };
  }

  const domain = (body.domain ?? "").trim();
  if (!VALID_DOMAINS.includes(domain as (typeof VALID_DOMAINS)[number])) {
    return { ok: false, error: `Domaine invalide. Attendu : ${VALID_DOMAINS.join(" | ")}.` };
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return { ok: false, error: "Le titre est requis." };
  }
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Le titre doit faire ≤ ${TITLE_MAX} caractères.` };
  }

  const content = (body.content ?? "").trim();
  if (!content) {
    return { ok: false, error: "Le contenu est requis." };
  }
  if (content.length > CONTENT_MAX) {
    return { ok: false, error: `Le contenu doit faire ≤ ${CONTENT_MAX} caractères.` };
  }

  const ageRangeRaw = (body.ageRange ?? "").trim();
  const ageRange =
    ageRangeRaw && VALID_AGE_RANGES.includes(ageRangeRaw as (typeof VALID_AGE_RANGES)[number])
      ? ageRangeRaw
      : null;

  // Détection PII (téléphone, email) — on avertit l'utilisateur, on ne rejette pas
  // (le contenu reste soumis à modération humaine). On lève juste un flag reportedCount.
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content) || pattern.test(title)) {
      return {
        ok: false,
        error:
          "On a détecté un numéro de téléphone ou un email dans ton témoignage. Pour ta sécurité, retire les infos qui pourraient t'identifier.",
      };
    }
  }

  // Détection apologie automutilation — refus direct (renvoi vers les ressources d'aide)
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(content)) {
      return {
        ok: false,
        error:
          "Si tu vas mal, tu n'es pas seul·e. Écris à Aya dans l'onglet Parler, ou appelle le 175 (SAMU CI). On ne peut pas publier ce témoignage, mais on est là pour t'écouter.",
      };
    }
  }

  return {
    ok: true,
    data: { anonymousId, domain, title, content, ageRange },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const where: { status: string; domain?: string } = { status: "approved" };
  if (domain && VALID_DOMAINS.includes(domain as (typeof VALID_DOMAINS)[number])) {
    where.domain = domain;
  }

  try {
    const [testimonies, total] = await Promise.all([
      db.testimony.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          domain: true,
          title: true,
          content: true,
          ageRange: true,
          hearts: true,
          createdAt: true,
        },
      }),
      db.testimony.count({ where }),
    ]);

    // On ne renvoie jamais l'anonymousId (bruit inutile + légitimité privacy).
    // reportedCount réservé aux modérateurs (route /moderation).
    const sanitized = testimonies.map((t) => ({
      id: t.id,
      domain: t.domain,
      title: t.title,
      content: t.content,
      ageRange: t.ageRange,
      hearts: t.hearts,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({
      testimonies: sanitized,
      total,
      hasMore: offset + testimonies.length < total,
    });
  } catch (err) {
    console.error("[Sankofa testimonies GET] Error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: TestimonyRequestBody;
  try {
    body = (await req.json()) as TestimonyRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu)." },
      { status: 400 },
    );
  }

  const validation = validateTestimony(body);
  if (!validation.ok || !validation.data) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const testimony = await db.testimony.create({
      data: {
        anonymousId: validation.data.anonymousId,
        domain: validation.data.domain,
        title: validation.data.title,
        content: validation.data.content,
        ageRange: validation.data.ageRange,
        status: "pending",
      },
      select: {
        id: true,
        status: true,
        domain: true,
        title: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ...testimony,
        moderationMessage: MODERATION_MESSAGE,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[Sankofa testimonies POST] DB error:", err);
    return NextResponse.json({ error: "Erreur de persistance." }, { status: 500 });
  }
}
