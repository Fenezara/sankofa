/**
 * GET /api/protocols/search?q=xxx&limit=10
 *
 * Recherche full-text dans les protocoles médicaux (RAG).
 * Utilise le même loadProtocols() que /api/protocols mais avec scoring.
 *
 * Response: {
 *   results: Array<{ slug, title, snippet, score, keywords }>,
 *   count, query
 * }
 */

import { NextResponse } from "next/server";
import { loadProtocols } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "10", 10) || 10, 20);

  if (!q || q.length < 2) {
    return NextResponse.json({
      results: [],
      count: 0,
      query: q,
      error: "Query trop courte (min 2 caractères).",
    });
  }

  try {
    const protocols = loadProtocols();

    const results = protocols
      .map((p) => {
        const titleLower = p.title.toLowerCase();
        const contentLower = p.content.toLowerCase();
        const keywordsLower = p.keywords.map((k) => k.toLowerCase());

        let score = 0;
        let snippet = "";

        // Title match : score élevé
        if (titleLower.includes(q)) {
          score += 10;
        }

        // Keyword match : score moyen
        for (const kw of keywordsLower) {
          if (kw.includes(q) || q.includes(kw)) {
            score += 5;
          }
        }

        // Content match : score faible + snippet
        const contentIdx = contentLower.indexOf(q);
        if (contentIdx >= 0) {
          score += 2;
          // Snippet : 100 chars autour du match
          const start = Math.max(0, contentIdx - 50);
          const end = Math.min(p.content.length, contentIdx + q.length + 50);
          snippet = (start > 0 ? "…" : "") + p.content.slice(start, end) + (end < p.content.length ? "…" : "");
        }

        return {
          slug: p.slug,
          title: p.title,
          snippet: snippet || p.content.slice(0, 120) + "…",
          score,
          keywords: p.keywords.slice(0, 5),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({
      results,
      count: results.length,
      query: q,
    });
  } catch (err) {
    console.error("[Sankofa protocols/search] Error:", err);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
