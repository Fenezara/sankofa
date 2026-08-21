"use client";

/**
 * Sankofa — Offline banner (PWA V3, enhanced V5)
 *
 * Bandeau flottant quand navigator.onLine === false.
 * - role="alert" (annonce aux lecteurs d'écran)
 * - Couleur : ambre-couchant / terre-brulee (cohérence palette Sankofa)
 * - Dismissible (état en mémoire, revient si offline prolongé)
 * - Bouton "Voir le contenu hors-ligne" → modal listant :
 *     · les protocoles santé mis en cache par le SW (cache-first)
 *     · les 10 dernières conversations (Q&A) issues du localStorage chat
 *     · compteur d'éléments cachés
 *
 * Hydration safety :
 *   - navigator.onLine lu en useEffect (post-mount)
 *   - caches.match() et localStorage lus en useEffect
 *   - aucun état dépendant du navigateur au render initial
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  WifiOff,
  X,
  Database,
  BookOpen,
  MessageSquare,
  DownloadCloud,
  Inbox,
} from "lucide-react";

// Cache name aligné avec public/sw.js
const PROTOCOLS_CACHE = "sankofa-v2-protocols";

interface ProtocolSummary {
  slug: string;
  title: string;
}

interface QAPair {
  question: string;
  answer: string;
  timestamp?: number;
}

export function OfflineBanner() {
  const [online, setOnline] = React.useState(true);
  const [dismissed, setDismissed] = React.useState(false);
  const [showOfflineContent, setShowOfflineContent] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);

    const onOnline = () => {
      setOnline(true);
      setDismissed(false);
    };
    const onOffline = () => {
      setOnline(false);
      setDismissed(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const show = !online && !dismissed;

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            role="alert"
            aria-live="assertive"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-md"
          >
            <div className="flex items-start gap-2.5 rounded-xl shadow-lg px-4 py-3 border border-terre-brulee/30 bg-ambre-couchant text-text-on-dark">
              <WifiOff className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 text-sm leading-snug">
                <strong className="block font-bold">Mode hors-ligne</strong>
                <span className="text-text-on-dark-soft">
                  Ton carnet chiffré reste accessible. Le chat IA nécessite une connexion.
                </span>
                <button
                  type="button"
                  onClick={() => setShowOfflineContent(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-noir-encre/30 hover:bg-noir-encre/50 border border-text-on-dark/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-on-dark/40"
                  aria-label="Voir le contenu disponible hors-ligne (protocoles et dernières conversations)"
                >
                  <Database className="size-3.5" aria-hidden="true" />
                  Voir le contenu hors-ligne
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Fermer le bandeau hors-ligne"
                className="p-1 rounded hover:bg-noir-encre/20 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal "Voir le contenu hors-ligne" — accessible même si le bandeau a été dismissé */}
      <OfflineContentModal
        open={showOfflineContent}
        onOpenChange={setShowOfflineContent}
      />
    </>
  );
}

/* ---------- Modal : contenu hors-ligne ---------- */

function OfflineContentModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [protocols, setProtocols] = React.useState<ProtocolSummary[] | null>(null);
  const [qaPairs, setQaPairs] = React.useState<QAPair[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cacheSource, setCacheSource] = React.useState<
    "cache" | "live-fallback" | "empty"
  >("empty");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    async function loadOfflineContent() {
      // 1. Protocoles — d'abord depuis le cache SW, puis fallback live si online
      let protos: ProtocolSummary[] = [];
      let source: "cache" | "live-fallback" | "empty" = "empty";

      try {
        if ("caches" in window) {
          const cache = await caches.open(PROTOCOLS_CACHE);
          const cached = await cache.match("/api/protocols");
          if (cached && cached.ok) {
            const data = (await cached.json()) as {
              protocols?: Array<{ slug: string; title: string }>;
            };
            if (data.protocols && data.protocols.length > 0) {
              protos = data.protocols.map((p) => ({
                slug: p.slug,
                title: p.title,
              }));
              source = "cache";
            }
          }
        }
      } catch {
        // Cache API peut échouer (mode privé etc.) — non bloquant
      }

      // Fallback live si on est online et qu'on n'a rien en cache
      if (protos.length === 0 && typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await fetch("/api/protocols", { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as {
              protocols?: Array<{ slug: string; title: string }>;
            };
            if (data.protocols) {
              protos = data.protocols.map((p) => ({
                slug: p.slug,
                title: p.title,
              }));
              source = "live-fallback";
            }
          }
        } catch {
          // Pas de réseau non plus — empty
        }
      }

      // 2. Dernières conversations Q&A depuis localStorage (chat history)
      let qas: QAPair[] = [];
      try {
        const raw = window.localStorage.getItem("aya:chatHistory");
        if (raw) {
          const history = JSON.parse(raw) as Array<{
            id?: string;
            role?: string;
            content?: string;
            ts?: number;
            persona?: string;
          }>;
          if (Array.isArray(history)) {
            // On extrait les paires user → assistant consécutives, en partant de la fin
            for (let i = history.length - 1; i >= 0 && qas.length < 10; i--) {
              const cur = history[i];
              if (!cur || cur.role !== "assistant" || !cur.content) continue;
              // Cherche le message user précédent
              let q = "";
              let ts: number | undefined;
              for (let j = i - 1; j >= 0; j--) {
                if (history[j]?.role === "user" && history[j]?.content) {
                  q = history[j]!.content!;
                  ts = history[j]!.ts;
                  break;
                }
              }
              if (q) {
                qas.push({
                  question: q,
                  answer: cur.content,
                  timestamp: ts ?? cur.ts,
                });
              }
            }
          }
        }
      } catch {
        // localStorage corrompu — ignore
      }

      if (cancelled) return;
      setProtocols(protos);
      setQaPairs(qas);
      setCacheSource(source);
      setLoading(false);
    }

    void loadOfflineContent();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Esc to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const totalCached = (protocols?.length ?? 0) + qaPairs.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Contenu disponible hors-ligne"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-noir-encre/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl border border-or-poudre-clair/25 bg-creme-baobab shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-or-poudre-clair/20 bg-sable-dore/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="size-9 rounded-lg bg-terre-brulee text-text-on-dark flex items-center justify-center shrink-0">
                  <Database className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2
                    className="text-base sm:text-lg font-bold text-text-on-light truncate"
                    style={{ fontFamily: "var(--font-bricolage)" }}
                  >
                    Contenu hors-ligne
                  </h2>
                  <p className="text-xs text-text-on-light-muted truncate">
                    {loading
                      ? "Chargement…"
                      : `${totalCached} élément(s) disponible(s) sans connexion`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Fermer"
                className="p-1.5 rounded-lg text-text-on-light-muted hover:text-text-on-light hover:bg-or-poudre-clair/20 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto aya-scroll px-4 sm:px-6 py-4 space-y-5">
              {cacheSource === "live-fallback" && (
                <div className="rounded-lg border border-ambre-couchant/40 bg-ambre-couchant/10 px-3 py-2 text-xs text-text-on-light-soft flex items-start gap-2">
                  <DownloadCloud className="size-4 shrink-0 mt-0.5 text-ocre-rouge" aria-hidden="true" />
                  <span>
                    Le cache hors-ligne n'est pas encore construit (en dev, le Service Worker
                    est désactivé). Voici un aperçu live — en production, ces protocoles seront
                    automatiquement mis en cache pour un accès 100% offline.
                  </span>
                </div>
              )}

              {/* Protocols */}
              <section aria-labelledby="offline-protocols-title">
                <h3
                  id="offline-protocols-title"
                  className="flex items-center gap-2 text-sm uppercase tracking-wider text-ocre-rouge font-semibold mb-2"
                >
                  <BookOpen className="size-4" aria-hidden="true" />
                  Protocoles santé
                  <span className="ml-auto text-xs text-text-on-light-muted font-normal normal-case tracking-normal">
                    {protocols?.length ?? 0} caché(s)
                  </span>
                </h3>
                {protocols === null ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-8 bg-or-poudre-clair/15 rounded animate-pulse"
                      />
                    ))}
                  </div>
                ) : protocols.length === 0 ? (
                  <div className="rounded-lg border border-or-poudre-clair/20 bg-sable-dore/30 p-4 text-center text-sm text-text-on-light-muted flex flex-col items-center gap-1.5">
                    <Inbox className="size-5" aria-hidden="true" />
                    Aucun protocole en cache.
                  </div>
                ) : (
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto aya-scroll pr-1">
                    {protocols.map((p) => (
                      <li
                        key={p.slug}
                        className="rounded-lg border border-or-poudre-clair/15 bg-sable-dore/20 px-3 py-2 text-sm text-text-on-light flex items-center gap-2"
                      >
                        <span className="size-1.5 rounded-full bg-ocre-rouge shrink-0" aria-hidden="true" />
                        <span className="font-medium truncate">{p.title}</span>
                        <span className="ml-auto text-[10px] font-mono text-text-on-light-muted shrink-0">
                          {p.slug}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Q&A pairs */}
              <section aria-labelledby="offline-qa-title">
                <h3
                  id="offline-qa-title"
                  className="flex items-center gap-2 text-sm uppercase tracking-wider text-ocre-rouge font-semibold mb-2"
                >
                  <MessageSquare className="size-4" aria-hidden="true" />
                  Dernières conversations
                  <span className="ml-auto text-xs text-text-on-light-muted font-normal normal-case tracking-normal">
                    {qaPairs.length} paire(s) Q/R
                  </span>
                </h3>
                {qaPairs.length === 0 ? (
                  <div className="rounded-lg border border-or-poudre-clair/20 bg-sable-dore/30 p-4 text-center text-sm text-text-on-light-muted flex flex-col items-center gap-1.5">
                    <Inbox className="size-5" aria-hidden="true" />
                    Aucune conversation récente en cache.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-y-auto aya-scroll pr-1">
                    {qaPairs.map((qa, i) => (
                      <li
                        key={`${qa.timestamp ?? i}-${i}`}
                        className="rounded-lg border border-or-poudre-clair/15 bg-sable-dore/20 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-1.5 text-ocre-rouge font-semibold mb-1">
                          <span className="size-1.5 rounded-full bg-rose-couchee" aria-hidden="true" />
                          Toi
                        </div>
                        <p className="text-text-on-light-soft mb-1.5 line-clamp-2">{qa.question}</p>
                        <div className="flex items-center gap-1.5 text-ocre-rouge font-semibold mb-1">
                          <span className="size-1.5 rounded-full bg-terracotta" aria-hidden="true" />
                          Sankofa
                        </div>
                        <p className="text-text-on-light-muted line-clamp-3">{qa.answer}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-or-poudre-clair/20 bg-sable-dore/40 flex items-center justify-between gap-2">
              <p className="text-[11px] text-text-on-light-muted">
                <kbd className="px-1.5 py-0.5 rounded bg-creme-baobab border border-or-poudre-clair/30 text-text-on-light-soft font-mono text-[10px]">
                  Esc
                </kbd>{" "}
                pour fermer
              </p>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-terre-brulee text-text-on-dark hover:bg-ocre-rouge transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OfflineBanner;
