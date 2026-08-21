/**
 * Sankofa — Service Worker (V5 — enhanced offline)
 *
 * Stratégies de cache :
 *  - Cache-first (network fallback)  : /_next/static/, /icons/, /fonts/, /images/, /logo.svg, /manifest.json
 *  - Network-first (cache fallback)  : pages HTML (/, navigation)
 *  - Cache-first (RAG offline)       : /api/protocols (GET) — protocoles santé publics
 *  - Stale-while-revalidate          : /api/chat (POST) — cache les 10 dernières Q&A
 *                                       clé = hash(message + persona), sans anonymousId (privacy)
 *  - Network-only + queue            : autres /api/* (POST échoué → background sync)
 *
 * Background sync : messages chat échoués en attente (queue) → retry quand online
 * Skip waiting    : active la nouvelle version immédiatement
 *
 * Offline chat fallback :
 *   Quand l'utilisateur envoie un message hors-ligne, le SW retourne la dernière
 *   réponse cachée pour cette question (si elle existe). Le client peut alors
 *   afficher "Tu es hors-ligne. Voici les dernières conversations." et lister
 *   les Q&A cachées via la Cache API.
 */

const CACHE_NAME = "sankofa-v2-cache";
const STATIC_CACHE = "sankofa-v2-static";
const DYNAMIC_CACHE = "sankofa-v2-dynamic";
const PROTOCOLS_CACHE = "sankofa-v2-protocols";
const CHAT_CACHE = "sankofa-v2-chat";

/** Nombre max de Q&A chat gardées en cache (LRU). */
const CHAT_CACHE_MAX = 10;

const STATIC_ASSETS_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\/fonts\//,
  /\/images\//,
  /\/logo\.svg$/,
  /\/manifest\.json$/,
  /\/robots\.txt$/,
];

const HTML_REQUEST = /\/(\?.*)?$/; // navigation requests

// Assets pré-cacheés au moment de l'install (minimal)
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        // Ne pas planter l'install si un asset manque
        console.warn("[Sankofa SW] Pre-cache partiel:", err);
      }
      // Skip waiting : active immédiatement
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nettoie les anciens caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              k !== STATIC_CACHE &&
              k !== DYNAMIC_CACHE &&
              k !== PROTOCOLS_CACHE &&
              k !== CHAT_CACHE &&
              k !== CACHE_NAME,
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ---------- Helper : est-ce une requête de navigation HTML ? ---------- */
function isHtmlRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") && HTML_REQUEST.test(new URL(request.url).pathname);
}

function isStaticAsset(url) {
  return STATIC_ASSETS_PATTERNS.some((p) => p.test(url));
}

/* ---------- Hash simple (FNV-1a 32-bit) pour clé de cache chat ---------- */
/**
 * Hash déterministe d'une string. Pas crypto-sécurisé, mais suffisant pour
 * générer une clé de cache stable (message + persona → même clé = même réponse).
 * On exclut anonymousId du hash pour :
 *   1. Préserver la privacy (pas de corrélation cross-user via le cache)
 *   2. Permettre le partage de réponses entre utilisateurs (cache hit plus fréquent)
 */
function fnv1aHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Base36 string, pad à 8 chars
  return (hash >>> 0).toString(36).padStart(8, "0");
}

/**
 * Extrait message + persona du body d'une requête POST /api/chat.
 * Retourne null si le body n'est pas parsable.
 */
async function extractChatKey(request) {
  try {
    const cloned = request.clone();
    const body = await cloned.json();
    const message = (body?.message ?? "").trim();
    const persona = body?.persona ?? "grande_soeur";
    if (!message) return null;
    return fnv1aHash(`${persona}::${message.toLowerCase()}`);
  } catch {
    return null;
  }
}

/* ---------- Stratégies ---------- */

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && fresh.type === "basic") {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // Fallback : page offline minimal si on n'a rien en cache
    if (isHtmlRequest(request)) {
      return new Response(
        "<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Sankofa — Hors-ligne</title><style>body{font-family:system-ui;background:#FBF3E4;color:#5C2A1A;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;text-align:center}h1{color:#9B3F1F}</style></head><body><div><h1>Mode hors-ligne</h1><p>Ton carnet chiffré reste accessible. Reviens quand tu as du réseau pour le chat IA.</p></div></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    throw err;
  }
}

async function networkFirstHtml(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Pas en cache : fallback offline minimal
    return new Response(
      "<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'><title>Sankofa — Hors-ligne</title><style>body{font-family:system-ui;background:#FBF3E4;color:#5C2A1A;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;text-align:center}h1{color:#9B3F1F}</style></head><body><div><h1>Mode hors-ligne</h1><p>Ton carnet chiffré reste accessible. Reviens quand tu as du réseau pour le chat IA.</p></div></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
    );
  }
}

/**
 * Cache-first pour /api/protocols (GET) — protocoles santé publics, RAG offline.
 * Essaie d'abord le cache, puis network, et met à jour le cache en arrière-plan.
 */
async function protocolsCacheFirst(request) {
  const cache = await caches.open(PROTOCOLS_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidate en arrière-plan (stale-while-revalidate)
    fetch(request)
      .then((fresh) => {
        if (fresh && fresh.ok) {
          cache.put(request, fresh.clone());
        }
      })
      .catch(() => {
        // Pas de réseau — on garde le cache
      });
    return cached;
  }
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // Pas de cache, pas de réseau → réponse vide mais valide
    return new Response(
      JSON.stringify({ protocols: [], count: 0, offline: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Stale-while-revalidate pour /api/chat (POST).
 *
 * - Cache les réponses réussies, clé = hash(message + persona)
 * - Sur hit : retourne la réponse cachée immédiatement + revalide en arrière-plan
 * - Sur miss online : fetch + cache (LRU, max 10 entrées)
 * - Sur miss offline : tente de retrouver une réponse similaire dans le cache,
 *   sinon queue pour background sync
 */
async function chatStaleWhileRevalidate(request) {
  const cacheKey = await extractChatKey(request);
  const cache = await caches.open(CHAT_CACHE);

  // Clé de cache synthétique (URL + hash) car les Response caches ne supportent
  // que des clés Request/URL string.
  const syntheticUrl = `https://sankofa.local/chat?q=${cacheKey ?? "unknown"}`;

  if (cacheKey) {
    const cached = await cache.match(syntheticUrl);
    if (cached) {
      // Stale-while-revalidate : retourne le cache, revalide en fond
      fetch(request)
        .then(async (fresh) => {
          if (fresh && fresh.ok) {
            const body = await fresh.clone().text();
            const cachedResponse = new Response(body, {
              status: fresh.status,
              statusText: fresh.statusText,
              headers: fresh.headers,
            });
            // Marque la réponse comme venant du cache (pour debug côté client)
            cachedResponse.headers.set("X-Sankofa-Cache", "revalidated");
            await cache.put(syntheticUrl, cachedResponse.clone());
            await trimChatCache(cache);
          }
        })
        .catch(() => {
          // Offline — on garde le cache tel quel
        });
      // Clone pour ajouter le header X-Sankofa-Cache: hit
      const cachedClone = cached.clone();
      const headers = new Headers(cachedClone.headers);
      headers.set("X-Sankofa-Cache", "hit");
      return new Response(await cachedClone.text(), {
        status: cachedClone.status,
        statusText: cachedClone.statusText,
        headers,
      });
    }
  }

  // Pas en cache — fetch live
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && cacheKey) {
      const body = await fresh.clone().text();
      const cachedResponse = new Response(body, {
        status: fresh.status,
        statusText: fresh.statusText,
        headers: fresh.headers,
      });
      cachedResponse.headers.set("X-Sankofa-Cache", "miss-stored");
      try {
        await cache.put(syntheticUrl, cachedResponse);
        await trimChatCache(cache);
      } catch {
        // Cache plein ou bloqué — non bloquant
      }
    }
    return fresh;
  } catch (err) {
    // Offline + pas de cache exact : on tente de retourner une réponse "offline"
    // avec un hint pour que le client affiche les dernières conversations.
    if (cacheKey) {
      // Vérifie s'il y a AU MOINS une entrée dans le cache chat (pour le fallback UI)
      const keys = await cache.keys();
      if (keys.length > 0) {
        return new Response(
          JSON.stringify({
            reply:
              "Tu es hors-ligne. Je n'ai pas de réponse exacte pour cette question en cache, " +
              "mais voici les dernières conversations enregistrées. Reviens quand tu as du réseau. 🌿",
            triageLevel: "info",
            offline: true,
            offlineCachedCount: keys.length,
            tpeActivated: false,
            protocolUsed: null,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Sankofa-Cache": "offline-fallback",
            },
          },
        );
      }
    }
    // Sinon : queue pour background sync
    if (request.method === "POST" && "sync" in self.registration) {
      try {
        const body = await request.clone().text();
        await saveToQueue({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body,
          timestamp: Date.now(),
        });
        await self.registration.sync.register("sankofa-chat-sync");
        return new Response(
          JSON.stringify({
            queued: true,
            offline: true,
            message:
              "Tu es hors-ligne. Ton message est enregistré — il sera envoyé dès que tu retrouves du réseau.",
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

/**
 * Limite le cache chat à CHAT_CACHE_MAX entrées (LRU basé sur l'ordre d'insertion
 * du Cache API — les clés les plus anciennes sont supprimées en premier).
 */
async function trimChatCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= CHAT_CACHE_MAX) return;
    const toRemove = keys.slice(0, keys.length - CHAT_CACHE_MAX);
    await Promise.all(toRemove.map((k) => cache.delete(k)));
  } catch {
    // ignore
  }
}

/**
 * Network-only pour les autres routes /api/*.
 */
async function networkOnly(request) {
  // Spécial : /api/protocols — cache-first pour RAG offline
  const url = new URL(request.url);
  if (url.pathname === "/api/protocols" && request.method === "GET") {
    return protocolsCacheFirst(request);
  }
  // Spécial : /api/chat — stale-while-revalidate
  if (url.pathname === "/api/chat" && request.method === "POST") {
    return chatStaleWhileRevalidate(request);
  }
  // Pour les autres : pas de cache, mais on queue pour background sync si POST
  try {
    return await fetch(request);
  } catch (err) {
    if (request.method === "POST" && "sync" in self.registration) {
      try {
        const body = await request.clone().text();
        await saveToQueue({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body,
          timestamp: Date.now(),
        });
        await self.registration.sync.register("sankofa-chat-sync");
        return new Response(
          JSON.stringify({
            queued: true,
            message: "Message en attente — sera envoyé dès que tu retrouves du réseau.",
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

/* ---------- IndexedDB (mini) pour la queue de background sync ---------- */
function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("sankofa-sw-queue", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToQueue(item) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").add(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromQueue() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const req = tx.objectStore("queue").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function clearQueue() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Background Sync ---------- */
self.addEventListener("sync", (event) => {
  if (event.tag === "sankofa-chat-sync") {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  const items = await getAllFromQueue();
  if (items.length === 0) return;
  for (const item of items) {
    try {
      await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
    } catch (err) {
      // Pas encore online — on réessaiera au prochain sync
      return;
    }
  }
  await clearQueue();
  // Notifier les clients
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "SANKOFA_SYNC_DONE", count: items.length });
  }
}

/* ---------- Fetch handler principal ---------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" && request.method !== "POST") return;

  const url = new URL(request.url);

  // Skip cross-origin
  if (url.origin !== self.location.origin) return;

  // /api/* : special handling (protocols cache-first, chat SWR, others network-only)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Navigation HTML : network-first
  if (isHtmlRequest(request)) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  // Static assets : cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Par défaut : cache-first sur dynamic
  event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
});
