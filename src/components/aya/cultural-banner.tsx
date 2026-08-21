"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentCulturalEvent, type CulturalEvent } from "@/lib/cultural-context";

/**
 * Sankofa — Bannière culturelle
 *
 * Affiche l'événement culturel/religieux actuel (Ramadan, examens, saison des pluies, etc.)
 * avec un conseil de santé adapté. Visible dans le Coach tab.
 *
 * Hydration-safe : mounted state gate.
 */
export function CulturalBanner() {
  const [event, setEvent] = React.useState<CulturalEvent | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const current = getCurrentCulturalEvent();
    setEvent(current);
    // Vérifie si déjà dismissé aujourd'hui
    try {
      const today = new Date().toISOString().slice(0, 10);
      const dismissedKey = `sankofa:cultural-dismissed-${today}`;
      if (localStorage.getItem(dismissedKey)) setDismissed(true);
    } catch {}
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`sankofa:cultural-dismissed-${today}`, "true");
    } catch {}
  };

  if (!mounted || !event || dismissed) return null;

  const emoji =
    event.type === "religieux" ? "🕌" :
    event.type === "scolaire" ? "📚" :
    event.type === "national" ? "🇨🇮" :
    event.type === "culturel" ? "🌿" : "💡";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="sankofa-card rounded-2xl p-4 border-l-4"
        style={{ borderLeftColor: "#E89B3C" }}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className="text-sm font-bold text-terre-brulee"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {event.name}
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-ocre-rouge/60 font-semibold">
                {event.type}
              </span>
            </div>
            <p className="text-xs text-ocre-rouge/80 leading-relaxed">
              {event.sankofaAdvice}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 text-ocre-rouge/40 hover:text-ocre-rouge/70 transition-colors p-1"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
