/**
 * Embeddings & semantic search — couche optionnelle au-dessus du RAG TF-IDF.
 *
 * Permet de remplacer la recherche par mots-clés (TF-IDF + fuzzy + stemming)
 * par une similarité vectorielle (cosine) sur les embeddings des protocoles.
 *
 * IMPORTANT — z-ai-web-dev-sdk v0.0.18 n'expose PAS d'endpoint embeddings.
 * Le code ci-dessous :
 *   - Tente d'appeler `zai.embeddings.create()` si la méthode existe
 *     (forward-compat avec une future version du SDK).
 *   - Si la méthode n'existe pas ou échoue → retourne null.
 *   - Le RAG retombe alors automatiquement sur TF-IDF (toujours dispo).
 *
 * Pour brancher un vrai service d'embeddings en production :
 *   1. Pose OPENAI_API_KEY (ou autre provider) en env.
 *   2. Remplace l'implémentation de `generateEmbedding()` par un appel à ce provider.
 *   3. Ré-indexe au prochain cold start — `indexProtocols()` est appelée lazy.
 *
 * Le vector store est en mémoire (MVP). Pour la prod, brancher pgvector,
 * Pinecone ou Qdrant. L'interface publique (`semanticSearch`) restera identique.
 */

import ZAI from "z-ai-web-dev-sdk";
import type { ProtocolDoc } from "@/lib/rag";

let zaiClient: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getClient() {
  if (zaiClient) return zaiClient;
  zaiClient = await ZAI.create();
  return zaiClient;
}

/**
 * Génère un embedding pour un texte.
 *
 * @returns tableau de floats, ou null si :
 *  - le SDK n'expose pas d'endpoint embeddings, OU
 *  - l'appel échoue (quota, réseau, etc.)
 *
 * Dans tous ces cas, le RAG retombe sur TF-IDF — pas d'erreur fatale.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const zai = await getClient();
    // Forward-compat : on appelle embeddings.create() si elle existe.
    const embeddingsApi = (zai as unknown as {
      embeddings?: {
        create?: (body: { input: string }) => Promise<{
          data?: Array<{ embedding?: number[] }>;
        }>;
      };
    }).embeddings;

    if (!embeddingsApi?.create) {
      // SDK sans endpoint embeddings — connu, pas une erreur.
      return null;
    }

    const result = await embeddingsApi.create({ input: text });
    if (result?.data?.[0]?.embedding) {
      return result.data[0].embedding;
    }
    return null;
  } catch (err) {
    console.warn("[Embeddings] Failed, falling back to keywords:", err);
    return null;
  }
}

/**
 * Calcule la similarité cosinus entre deux vecteurs.
 * Retourne 0 si les vecteurs ont des dimensions différentes ou sont nuls.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

interface VectorDoc {
  slug: string;
  content: string;
  embedding: number[];
}

const vectorStore: VectorDoc[] = [];
let indexed = false;
let indexingInProgress: Promise<void> | null = null;

/**
 * Indexe tous les protocoles : pour chacun, génère un embedding et le stocke
 * en mémoire. Idempotent et thread-safe (guard `indexingInProgress`).
 *
 * Si `generateEmbedding()` retourne null pour un protocole (SDK sans
 * embeddings), ce protocole est juste absent du vector store — la recherche
 * semantic renverra [], et le RAG retombera sur TF-IDF.
 *
 * @param protocols Liste des protocoles chargés par `loadProtocols()` du RAG.
 */
export async function indexProtocols(
  protocols: { slug: string; content: string }[],
): Promise<void> {
  if (indexed || indexingInProgress) {
    await indexingInProgress;
    return;
  }

  indexingInProgress = (async () => {
    vectorStore.length = 0;
    for (const p of protocols) {
      const embedding = await generateEmbedding(p.content);
      if (embedding && embedding.length > 0) {
        vectorStore.push({ slug: p.slug, content: p.content, embedding });
      }
    }
    indexed = true;
    if (vectorStore.length > 0) {
      console.log(
        `[Embeddings] Indexed ${vectorStore.length}/${protocols.length} protocols.`,
      );
    } else {
      console.log(
        "[Embeddings] Aucun protocole indexé (SDK sans endpoint embeddings ? TF-IDF sera utilisé).",
      );
    }
  })();

  await indexingInProgress;
}

/**
 * Recherche sémantique : top-K protocoles les plus proches de la requête
 * (cosine similarity sur embeddings).
 *
 * @returns tableau trié par score décroissant, ou [] si :
 *  - pas encore indexé, OU
 *  - vector store vide (embeddings indispo), OU
 *  - embedding de la requête échoue
 */
export async function semanticSearch(
  query: string,
  k: number = 3,
): Promise<{ slug: string; score: number; content: string }[]> {
  if (!indexed || vectorStore.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  const scored = vectorStore.map((doc) => ({
    slug: doc.slug,
    content: doc.content,
    score: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  return scored
    .filter((s) => s.score > 0.3) // seuil minimal pour éviter le bruit
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Indique si les embeddings sont dispo et indexés.
 * Permet au RAG de savoir s'il peut tenter semanticSearch() ou skip direct.
 */
export function isIndexed(): boolean {
  return indexed && vectorStore.length > 0;
}

/**
 * Récupère les documents indexés (debug / introspection).
 */
export function getIndexedDocs(): { slug: string; dim: number }[] {
  return vectorStore.map((d) => ({ slug: d.slug, dim: d.embedding.length }));
}

/**
 * Helper pour le RAG : convertit un tableau de ProtocolDoc en format
 * attendu par indexProtocols.
 */
export function protocolsToIndexable(
  protocols: ProtocolDoc[],
): { slug: string; content: string }[] {
  return protocols.map((p) => ({ slug: p.slug, content: p.content }));
}
