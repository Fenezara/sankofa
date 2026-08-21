/**
 * GET /api/protocols
 *
 * Renvoie tous les protocoles santé indexés (format JSON) pour :
 *  - Côté client : affichage, recherche, prévisualisation
 *  - Service Worker : mise en cache pour le RAG offline (cache-first dans sw.js)
 *
 * Response: { protocols: Array<{ slug, title, keywords, content }>, count, cachedAt }
 *
 * ⚠️ Note sécurité : contenu PUBLIC (protocoles médicaux validés par le comité Sankofa).
 *   Aucune donnée patient, aucun PII. Sûr à mettre en cache côté client.
 */

import { NextResponse } from 'next/server';
import { loadProtocols } from '@/lib/rag';

export const runtime = 'nodejs';
// Les protocoles ne changent qu'au redéploiement — cache navigateur 1h, SW cache-first
export const revalidate = 3600;

export async function GET() {
  try {
    const protocols = loadProtocols().map((p) => ({
      slug: p.slug,
      title: p.title,
      keywords: p.keywords,
      content: p.content,
    }));

    return NextResponse.json(
      {
        protocols,
        count: protocols.length,
        cachedAt: new Date().toISOString(),
      },
      {
        headers: {
          // Cache navigateur 1h ; le SW gère sa propre stratégie (cache-first)
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error('[/api/protocols] Erreur:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les protocoles.' },
      { status: 500 },
    );
  }
}
