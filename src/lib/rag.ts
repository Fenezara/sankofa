/**
 * RAG — Retrieval Augmented Generation (V3)
 *
 * Améliorations V3 vs V2 :
 *  1. Scoring TF-IDF lite (term frequency × inverse document frequency)
 *     au lieu d'un simple match booléen par mot-clé.
 *  2. Fuzzy matching (distance de Levenshtein ≤ 1) sur tokens > 4 lettres —
 *     tolère les fautes de frappe ("contrceptif" → "contraceptif").
 *  3. TPE boost : quand un contexte TPE est détecté, le score du protocole
 *     `tpe-vih` est multiplié par 2.
 *  4. Top-K : retourne les 3 meilleurs protocoles par défaut (au lieu de 2).
 *
 * Interface publique : `retrieveProtocols(message, k?) -> ProtocolDoc[]`
 * (compatible V2).
 */

import fs from "node:fs";
import path from "node:path";

export interface ProtocolDoc {
  slug: string; // ex: 'tpe-vih'
  title: string; // ex: 'TPE VIH'
  keywords: string[]; // mots-clés dérivés pour le matching
  content: string; // contenu markdown complet
  /** Tokens uniques du document (pour TF-IDF) */
  tokens: string[];
}

const PROTOCOLS_DIR = path.join(process.cwd(), "src", "lib", "protocols");
const TPE_SLUG = "tpe-vih";
const DEFAULT_K = 3;

let cache: ProtocolDoc[] | null = null;

/* ---------- Tokenisation & extraction ---------- */

const STOP_WORDS = new Set([
  "qui", "quoi", "comment", "dans", "pour", "avec", "sans", "ainsi", "selon",
  "apres", "avant", "entre", "chaque", "toutes", "tous", "leur", "leurs",
  "cette", "cela", "ceci", "etre", "avoir", "faire", "peut", "doit",
  "sont", "elles", "aussi", "alors", "donc", "mais", "plus",
  "moins", "tres", "trop", "bien", "contre", "pendant", "depuis",
  "une", "des", "les", "aux", "par", "sur", "sous", "via", "via",
  "est", "sont", "été", "été", "ces", "ses", "mes", "tes", "nos", "vos",
  "mon", "ton", "son", "ma", "ta", "sa", "et", "ou", "ni", "car",
  "que", "qui", "quoi", "dont", "où", "ne", "pas", "jamais", "rien",
  "the", "and", "for", "with", "this", "that", "from", "are", "was",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function tokenize(text: string): string[] {
  const normalized = normalize(text);
  const tokens = normalized.match(/[a-z0-9]+/g) || [];
  return tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function extractTitle(markdown: string, slug: string): string {
  const firstH1 = markdown.match(/^#\s+(.+)$/m);
  if (firstH1) return firstH1[1].trim();
  return slug;
}

function extractKeywords(markdown: string, slug: string): string[] {
  const lower = markdown.toLowerCase();
  const keywords = new Set<string>();

  // slug lui-même
  keywords.add(slug);
  keywords.add(slug.replace(/-/g, " "));

  // titres de sections (## ...)
  const h2 = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].toLowerCase());
  h2.forEach((h) => keywords.add(h));

  // mots significatifs (> 5 lettres) apparaissant dans les 100 premières lignes
  const head = lower.split("\n").slice(0, 100).join(" ");
  const words = head.match(/[a-zàâäéèêëïîôöùûüç]{6,}/g) || [];
  for (const w of words) {
    if (!STOP_WORDS.has(w)) keywords.add(w);
  }

  return [...keywords];
}

/**
 * Charge et indexe tous les protocoles depuis src/lib/protocols/*.md
 * Résultat mis en cache pour la durée de vie du processus.
 */
export function loadProtocols(): ProtocolDoc[] {
  if (cache) return cache;
  if (!fs.existsSync(PROTOCOLS_DIR)) {
    cache = [];
    return cache;
  }
  const files = fs.readdirSync(PROTOCOLS_DIR).filter((f) => f.endsWith(".md"));
  cache = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const content = fs.readFileSync(path.join(PROTOCOLS_DIR, file), "utf8");
    const tokens = tokenize(content);
    return {
      slug,
      title: extractTitle(content, slug),
      keywords: extractKeywords(content, slug),
      content,
      tokens,
    };
  });
  return cache;
}

/* ---------- Fuzzy matching (Levenshtein) ---------- */

/**
 * Distance de Levenshtein entre deux chaînes.
 * Optimisée pour de courts tokens (≤ ~20 chars).
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return Math.max(m, n); // trop différent
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Vrai si deux tokens sont équivalents à distance d'édition ≤ 1.
 * On n'applique le fuzzy que pour tokens de longueur ≥ 5 (sinon trop
 * de faux positifs sur les mots courts).
 */
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  return levenshtein(a, b) <= 1;
}

/**
 * Préfixe commun le plus long entre deux chaînes.
 */
function commonPrefixLen(a: string, b: string): number {
  const min = Math.min(a.length, b.length);
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  return i;
}

/**
 * Stemming-lite français : retire les suffixes morphologiques courants
 * afin que "contraceptif", "contraception", "contraceptive", "contraceptives"
 * tombent tous sur la même racine "contracep".
 *
 * N'applique que pour tokens de longueur ≥ 7 (sinon risque de trop éroser
 * les mots courts et créer des faux positifs).
 */
const FRENCH_SUFFIXES = [
  "tions", "tion", "tifs", "tive", "tives", "tif",
  "sions", "sion", "ements", "ement", "ations", "ation",
  "ables", "able", "ibles", "ible",
  "ements", "ement",
  "es", "s",
];

function stem(word: string): string {
  if (word.length < 7) return word;
  for (const suf of FRENCH_SUFFIXES) {
    if (word.length > suf.length + 3 && word.endsWith(suf)) {
      return word.slice(0, word.length - suf.length);
    }
  }
  return word;
}

/**
 * Vrai si deux tokens partagent un préfixe commun suffisamment long
 * pour être considérés comme "apparentés" (typiquement des variantes
 * morphologiques comme "contraceptif" / "contraception" / "contraceptive").
 *
 * Règle : préfixe commun ≥ 6 chars ET au moins un des deux tokens fait ≥ 7 chars.
 */
function stemLikeMatch(a: string, b: string): boolean {
  if (a.length < 7 || b.length < 7) return false;
  return commonPrefixLen(a, b) >= 6;
}

/**
 * Vrai si les racines (stems) des deux tokens sont identiques.
 * Capture les variantes morphologiques que fuzzy et stemLike ratent
 * (ex : "contrceptif" → stem "contrcep" vs "contraception" → stem "contracep"
 *  qui diffèrent encore, mais "contraceptif" → "contracep" match "contraception" → "contracep").
 *
 * On accepte aussi une distance ≤ 1 entre les stems (typo résiduelle).
 */
function stemMatch(a: string, b: string): boolean {
  const sa = stem(a);
  const sb = stem(b);
  if (sa === sb && sa.length >= 6) return true;
  if (sa.length >= 6 && sb.length >= 6 && Math.abs(sa.length - sb.length) <= 1) {
    return levenshtein(sa, sb) <= 1;
  }
  return false;
}

/* ---------- TF-IDF lite ---------- */

/**
 * Calcule un score TF-IDF-lite :
 *  - TF(t, d)   = nb occurrences de t dans le doc d (normalisé par taille du doc)
 *  - IDF(t)     = log(N / df(t))  — N = nb docs, df(t) = nb docs contenant t
 *  - score(d, q) = somme sur t∈q de TF(t,d) * IDF(t)
 *
 * Le token t peut matcher via fuzzy (tolérance faute de frappe).
 */
function buildIdf(protocols: ProtocolDoc[]): Map<string, number> {
  const N = protocols.length;
  const df = new Map<string, number>();
  for (const p of protocols) {
    const seen = new Set<string>(p.tokens);
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [t, freq] of df) {
    // +1 lissage pour éviter division par zéro et explosion IDF
    idf.set(t, Math.log((N + 1) / (freq + 1)) + 1);
  }
  return idf;
}

/**
 * Score un document pour une liste de tokens requête.
 * Applique TF-IDF + bonus pour match keyword direct + bonus fuzzy.
 */
function scoreDocument(
  doc: ProtocolDoc,
  queryTokens: string[],
  idf: Map<string, number>,
  keywordsNormalized: Set<string>,
): number {
  if (queryTokens.length === 0) return 0;

  // TF : occurrences par token dans le doc.
  // Note : on NE normalise PAS par docSize — les protocoles font tous ~300-400 tokens
  // (même ordre de grandeur), et normaliser érode le score des matches exacts au point
  // qu'un simple partial-substring (0.05) les domine. On garde donc TF brut.
  const tfMap = new Map<string, number>();
  for (const t of doc.tokens) {
    tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
  }

  let score = 0;
  for (const qt of queryTokens) {
    // TF-IDF direct (match exact) — poids fort × 3
    const tf = tfMap.get(qt);
    if (tf !== undefined) {
      const idfVal = idf.get(qt) ?? 1;
      score += tf * idfVal * 3; // poids exact × 3
      continue;
    }
    // Fuzzy : cherche un token du doc à distance ≤ 1
    let matchedDocToken: string | null = null;
    let matchedWeight = 0;
    for (const dt of doc.tokens) {
      if (fuzzyMatch(qt, dt)) {
        matchedDocToken = dt;
        matchedWeight = 0.8;
        break;
      }
      // Stem-like (préfixe commun ≥ 6) : capture "contraceptif" ↔ "contraception"
      if (matchedWeight < 0.6 && stemLikeMatch(qt, dt)) {
        matchedDocToken = dt;
        matchedWeight = 0.6;
        // ne break pas : un fuzzy plus précis pourrait exister
      }
      // Stem match (racine identique ou distance 1 sur racine) : capture typo + variante
      // ex : "contrceptif" (typo) ↔ "contraception" via stems "contrcep" / "contracep" (distance 1)
      if (matchedWeight < 0.5 && stemMatch(qt, dt)) {
        matchedDocToken = dt;
        matchedWeight = 0.5;
      }
    }
    if (matchedDocToken) {
      const idfVal = idf.get(matchedDocToken) ?? 1;
      score += (tfMap.get(matchedDocToken) ?? 1) * idfVal * matchedWeight;
      continue;
    }

    // Match sur keywords exacts (qt lui-même est un keyword)
    if (keywordsNormalized.has(qt)) {
      score += 0.3;
      continue;
    }
    // Sous-chaîne (partial) : bonus léger — volontairement petit pour ne pas
    // écraser les matches exacts TF-IDF (0.05 seulement).
    for (const kw of keywordsNormalized) {
      if (kw.length > 4 && (kw.includes(qt) || qt.includes(kw))) {
        score += 0.05;
        break;
      }
    }
  }

  return score;
}

/* ---------- API publique ---------- */

/**
 * Récupère les protocoles pertinents pour un message utilisateur.
 * Retourne un tableau trié par score décroissant (limité à maxResults).
 *
 * V3 :
 *  - TF-IDF scoring
 *  - Fuzzy matching (Levenshtein ≤ 1) sur tokens ≥ 5 lettres
 *  - TPE boost ×2 si contexte TPE détecté
 *  - top-K = 3 par défaut
 */
export function retrieveProtocols(message: string, maxResults = DEFAULT_K): ProtocolDoc[] {
  const protocols = loadProtocols();
  if (protocols.length === 0) return [];

  const queryTokens = tokenize(message);
  if (queryTokens.length === 0) return [];

  const idf = buildIdf(protocols);

  // TPE boost : si le message évoque le TPE, boost ×2 sur tpe-vih
  const tpeInfo = detectTPE(message);
  const tpeBoost = tpeInfo.activated;

  const scored = protocols.map((p) => {
    const keywordsNormalized = new Set(p.keywords.map((k) => normalize(k)));
    let score = scoreDocument(p, queryTokens, idf, keywordsNormalized);
    // TPE boost
    if (tpeBoost && p.slug === TPE_SLUG) {
      score *= 2;
    }
    return { doc: p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.doc);
}

/**
 * Formate les protocoles récupérés pour injection dans le system prompt.
 * Tronque chaque protocole à ~2000 caractères pour limiter le contexte.
 */
export function formatRetrievedProtocols(docs: ProtocolDoc[]): string {
  if (docs.length === 0) {
    return "(Aucun protocole spécifique retrouvé pour cette question. Reste sur les orientations générales : écoute, anonymat, orientation vers AIBEF / CHU / 143.)";
  }
  return docs
    .map((d) => {
      const truncated =
        d.content.length > 2000 ? d.content.slice(0, 2000) + "\n[...]" : d.content;
      return `### Protocole: ${d.title}\n\n${truncated}`;
    })
    .join("\n\n---\n\n");
}

/* ============================================================
 * RAG sémantique (embeddings) — optionnel, tombe sur TF-IDF si indispo
 * ============================================================
 *
 * `retrieveProtocolsSemantic()` essaie d'abord une recherche vectorielle
 * (cosine similarity sur embeddings). Si les embeddings ne sont pas dispo
 * (SDK sans endpoint, erreur API, index vide), elle retourne [] et le caller
 * doit retomber sur `retrieveProtocols()` (TF-IDF + fuzzy).
 *
 * Usage typique (dans chat-pipeline.ts) :
 *   let docs = await retrieveProtocolsSemantic(message, 3);
 *   if (docs.length === 0) docs = retrieveProtocols(message, 3);
 *
 * Le vector store est en mémoire — il se (re)construit au premier appel
 * (cold start) puis reste en cache pour la durée de vie du processus.
 */

import {
  indexProtocols,
  semanticSearch,
  isIndexed,
  protocolsToIndexable,
} from "./embeddings";

let semanticInitStarted = false;
let semanticInitPromise: Promise<void> | null = null;

/**
 * Initialise l'index sémantique (lazy, thread-safe).
 * Si les embeddings ne sont pas dispo, cette fonction ne fait rien
 * (l'index reste vide, `isIndexed()` renvoie false).
 */
async function ensureSemanticIndex(): Promise<void> {
  if (isIndexed() || semanticInitPromise) {
    await semanticInitPromise;
    return;
  }
  if (semanticInitStarted) return;
  semanticInitStarted = true;
  const protocols = loadProtocols();
  semanticInitPromise = indexProtocols(protocolsToIndexable(protocols));
  await semanticInitPromise;
}

/**
 * Récupère les protocoles pertinents par similarité vectorielle (cosine).
 *
 * @returns tableau de ProtocolDoc trié par score décroissant (top-K),
 *          ou [] si embeddings indispo / non indexé / aucun match > seuil.
 *
 * L'appelant doit TOUJOURS retomber sur `retrieveProtocols()` (TF-IDF)
 * si cette fonction renvoie [].
 */
export async function retrieveProtocolsSemantic(
  message: string,
  maxResults = DEFAULT_K,
): Promise<ProtocolDoc[]> {
  try {
    await ensureSemanticIndex();
    if (!isIndexed()) return [];

    const hits = await semanticSearch(message, maxResults);
    if (hits.length === 0) return [];

    // Reconstitue les ProtocolDoc complets à partir des slugs hit.
    const protocols = loadProtocols();
    const bySlug = new Map(protocols.map((p) => [p.slug, p]));
    const docs: ProtocolDoc[] = [];
    for (const hit of hits) {
      const doc = bySlug.get(hit.slug);
      if (doc) docs.push(doc);
    }
    return docs;
  } catch (err) {
    console.warn("[RAG] retrieveProtocolsSemantic error:", err);
    return [];
  }
}

/**
 * Détecte un contexte TPE (Traitement Post-Exposition) dans le message.
 * Retourne un booléen et, si possible, le nombre d'heures estimé depuis le rapport.
 */
export function detectTPE(message: string): { activated: boolean; estimatedHours?: number } {
  const normalized = normalize(message);
  const hasRapport = /\brapport\b/.test(normalized);
  const hasRiskContext =
    /rapport non protege|rapport risque|sans preservatif|preservatif.{0,15}(craque|creve|casse|perce)|\bcraque\b|\bcreve\b|rapport a risque/.test(
      normalized,
    );
  if (!hasRapport && !hasRiskContext) {
    return { activated: false };
  }

  // Détection temporelle : "hier", "ce matin", "la nuit", "il y a X heures/jours"
  const hoursMatch = normalized.match(/il y a (\d+)\s*(h|heure|heures)/);
  if (hoursMatch) {
    const h = parseInt(hoursMatch[1], 10);
    if (h <= 72) return { activated: true, estimatedHours: h };
    return { activated: false }; // > 72h, TPE n'est plus indiqué
  }

  const daysMatch = normalized.match(/il y a (\d+)\s*(j|jour|jours)/);
  if (daysMatch) {
    const h = parseInt(daysMatch[1], 10) * 24;
    if (h <= 72) return { activated: true, estimatedHours: h };
    return { activated: false };
  }

  // Indicateurs de temps récents (< 72h)
  const recentIndicators = [
    { regex: /\bhier\b/, hours: 24 },
    { regex: /\bhier soir\b/, hours: 24 },
    { regex: /\bhier nuit\b/, hours: 20 },
    { regex: /\bce matin\b/, hours: 6 },
    { regex: /\bce soir\b/, hours: 1 },
    { regex: /\bla nuit derniere\b/, hours: 12 },
    { regex: /\bavant[- ]hier\b/, hours: 48 },
    { regex: /\bavant avant[- ]hier\b/, hours: 72 },
    { regex: /\bce week[- ]?end\b/, hours: 48 },
    { regex: /\brecemment\b/, hours: 12 },
  ];
  for (const { regex, hours } of recentIndicators) {
    if (regex.test(normalized)) {
      return { activated: true, estimatedHours: hours };
    }
  }

  // Si on a "rapport non protégé" sans indication de temps, on active par précaution
  if (hasRiskContext) {
    return { activated: true };
  }

  return { activated: false };
}
