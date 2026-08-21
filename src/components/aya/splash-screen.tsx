"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SankofaLogo } from "@/components/aya/sankofa-logo";

/**
 * Sankofa — Splash Screen
 *
 * Affiche le logo Sankofa plein écran IMMÉDIATEMENT au clic sur l'icône,
 * AVANT que les autres pages ne commencent à s'afficher.
 *
 * Comportement :
 *  - Affiché au tout premier render (SSR + client)
 *  - Fade out après ~1.8s ou quand l'app est prête
 *  - Ne s'affiche plus sur les navigations internes (localStorage flag)
 *
 * Design :
 *  - Fond mesh-gradient (chaud, cinématique)
 *  - Logo 120px avec halo pulsant (.logo-glow)
 *  - Particules embers (effet premium)
 *  - Texte "Sankofa" + tagline
 *  - Fade out smooth (opacity + scale)
 */

const SPLASH_KEY = "sankofa:splash-shown";
const SPLASH_DURATION_MS = 2200;

export function SplashScreen({ children }: { children: React.ReactNode }) {
  // Affiche le splash par défaut (true) → s'affiche au tout premier render
  const [showSplash, setShowSplash] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    // Vérifie si le splash a déjà été montré dans cette session de navigateur
    // (pas dans cette session de tab — on utilise localStorage pour persister)
    try {
      const lastShown = localStorage.getItem(SPLASH_KEY);
      const now = Date.now();

      // Affiche le splash si :
      //  - jamais montré
      //  - OU montré il y a plus de 30 minutes (nouvelle "session" app)
      if (!lastShown || now - parseInt(lastShown, 10) > 30 * 60 * 1000) {
        setShowSplash(true);
        localStorage.setItem(SPLASH_KEY, now.toString());

        // Fade out après SPLASH_DURATION_MS
        const timer = setTimeout(() => {
          setShowSplash(false);
        }, SPLASH_DURATION_MS);

        return () => clearTimeout(timer);
      } else {
        // Splash déjà montré récemment → ne pas afficher
        setShowSplash(false);
      }
    } catch {
      // localStorage bloqué → affiche le splash quand même
      setShowSplash(true);
      const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center mesh-gradient overflow-hidden"
          >
            {/* Ember particles */}
            <div className="ember-field" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="ember" />
              ))}
            </div>

            {/* Logo + glow */}
            <motion.div
              initial={mounted ? { opacity: 0, scale: 0.85 } : false}
              animate={mounted ? { opacity: 1, scale: 1 } : undefined}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="logo-glow relative z-10"
              style={{ width: 140, height: 140 }}
            >
              <SankofaLogo size={140} animated />
            </motion.div>

            {/* Nom + tagline */}
            <motion.div
              initial={mounted ? { opacity: 0, y: 16 } : false}
              animate={mounted ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 mt-8 text-center px-6"
            >
              <h1
                className="text-3xl font-black text-creme-baobab tracking-wide"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                Sankofa
              </h1>
              <p className="text-sm text-creme-baobab/70 mt-2 font-medium tracking-wider">
                Ton aîné·e santé
              </p>
            </motion.div>

            {/* Barre de chargement subtile */}
            <motion.div
              initial={mounted ? { opacity: 0 } : false}
              animate={mounted ? { opacity: 1 } : undefined}
              transition={{ duration: 0.4, delay: 0.8 }}
              className="absolute bottom-20 z-10"
            >
              <div className="w-32 h-1 rounded-full bg-creme-baobab/15 overflow-hidden">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    duration: 1.2,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                  className="h-full w-full rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, #F4C77B 50%, transparent 100%)",
                  }}
                />
              </div>
            </motion.div>

            {/* Mention */}
            <motion.p
              initial={mounted ? { opacity: 0 } : false}
              animate={mounted ? { opacity: 0.5 } : undefined}
              transition={{ duration: 0.6, delay: 1 }}
              className="absolute bottom-6 z-10 text-[10px] text-creme-baobab/40 font-medium tracking-widest uppercase"
            >
              Façonnée en Côte d'Ivoire 🇨🇮
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
