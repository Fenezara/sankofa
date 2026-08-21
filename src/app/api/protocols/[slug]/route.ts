/**
 * GET /api/protocols/[slug]
 *
 * Retourne le détail d'un protocole médical par son slug.
 * Source de vérité pour le contenu RAG (même source que /api/protocols).
 *
 * Response: {
 *   slug, title, domain, content (markdown), sources, updatedAt
 * }
 *
 * Public (anonyme) — pas d'auth requise (infos santé générales validées OMS).
 */

import { NextResponse } from "next/server";
import { loadProtocols } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: slugParam } = await params;
  const slug = slugParam?.trim().toLowerCase();

  if (!slug) {
    return NextResponse.json(
      { error: "Slug requis." },
      { status: 400 },
    );
  }

  try {
    const protocols = loadProtocols();
    const protocol = protocols.find((p) => p.slug === slug);

    if (!protocol) {
      return NextResponse.json(
        { error: `Protocole "${slug}" introuvable.`,
          availableSlugs: protocols.map((p) => p.slug) },
        { status: 404 },
      );
    }

    return NextResponse.json({
      slug: protocol.slug,
      title: protocol.title,
      content: protocol.content,
      keywords: protocol.keywords,
    });
  } catch (err) {
    console.error("[Sankofa protocols/[slug]] Error:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 },
    );
  }
}
