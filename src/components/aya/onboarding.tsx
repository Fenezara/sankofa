"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SankofaLogo } from "@/components/aya/sankofa-logo";

const ONBOARDED_KEY = "sankofa:onboarded";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const onboarded = localStorage.getItem(ONBOARDED_KEY);
      if (!onboarded) setShowOnboarding(true);
    } catch {}
  }, []);

  const complete = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "true");
    } catch {}
    setShowOnboarding(false);
  };

  if (!mounted) return <>{children}</>;

  return (
    <>
      {children}
      <AnimatePresence>
        {showOnboarding && <OnboardingOverlay onComplete={complete} />}
      </AnimatePresence>
    </>
  );
}

/**
 * Cinematic onboarding overlay (V4 — premium visual polish).
 *
 * Design changes vs V3:
 *   - Flat linear-gradient → animated mesh-gradient background (warm radial blobs)
 *   - Centered flat layout → asymmetric (logo left, text right-aligned — rule of thirds)
 *   - Plain card → glassmorphism glass card (backdrop-blur + warm border)
 *   - Single fade → staggered reveal (title 400ms → subtitle 600ms → buttons 800ms)
 *   - 10 floating ember particles animate upward (CSS-only, no lib)
 *   - SankofaLogo wrapped in `.logo-glow` for pulsing radial halo
 *   - Pager dots → animated pill (active dot grows + glows via `.glow-pulse`)
 *   - Buttons → gradient fill (cream → or-poudre-clair) + colored soft shadow
 *     (terracotta 20%) + scale 0.97 on active via `.press` utility
 *   - "Passer" link → `.link-passer` (small-caps, letter-spacing, opacity hover)
 *
 * Hydration-safe: `mounted` state gates staggered animations so SSR renders same
 * as the first client render (no framer-motion variants running on server).
 */
function OnboardingOverlay({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const slides = [
    {
      title: "Tu n'es pas seul·e",
      text: "Chaque nuit à Abidjan, des jeunes comme toi cherchent des réponses. Sankofa est là pour toi, 24/7.",
    },
    {
      title: "Sankofa arrive",
      text: "Ton aîné·e santé. Validé par des médecins ivoiriens. 100% anonyme. En français et Nouchi. (Dioula et Baoulé en audio bientôt.)",
    },
    {
      title: "Commence ton voyage",
      text: "5 domaines : SSR, addictologie, dermatologie, santé mentale, nutrition. 1 coach qui ne te jugera jamais.",
    },
  ];

  const current = slides[step];

  // Staggered reveal: title 400ms, subtitle 600ms, dots 800ms, buttons 800ms.
  // Hydration-safe: only apply the "hidden" → "show" once mounted on client.
  const reveal = (delay: number) => ({
    initial: mounted ? { opacity: 0, y: 24 } : false,
    animate: mounted ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-hidden mesh-gradient"
    >
      {/* Floating ember particles — CSS-only, warm dots rising like embers */}
      <div className="ember-field" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="ember" />
        ))}
      </div>

      {/* Glass content card — backdrop-blur + warm tint + subtle border */}
      <motion.div
        key={step}
        initial={mounted ? { opacity: 0, scale: 0.98 } : false}
        animate={mounted ? { opacity: 1, scale: 1 } : undefined}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
        className="glass relative z-10 w-full max-w-lg mx-auto rounded-3xl px-6 sm:px-10 py-10 sm:py-14 flex flex-col gap-6"
      >
        {/* Logo centered + larger — ancre visuelle */}
        <div className="flex justify-center">
          <div
            className="logo-glow shrink-0 flex items-center justify-center"
            style={{ width: 120, height: 120 }}
          >
            {step === 0 && <SankofaLogo size={120} animated />}
            {step === 1 && <SankofaLogo size={120} animated withText />}
            {step === 2 && (
              <div className="flex gap-3 text-4xl">
                <span>💬</span>
                <span>🌿</span>
                <span>🕐</span>
                <span>📓</span>
                <span>ℹ️</span>
              </div>
            )}
          </div>
        </div>

        {/* Title — blanc uni pour contraste maximal sur fond sombre */}
        <motion.h1
          {...reveal(0.4)}
          className="text-center text-3xl sm:text-4xl font-black text-creme-baobab leading-tight"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          {current.title}
        </motion.h1>

        <motion.p
          {...reveal(0.6)}
          className="text-center text-base sm:text-lg text-creme-baobab/85 leading-relaxed"
        >
          {current.text}
        </motion.p>

        {/* Pager dots — animated pill (active dot grows + glows) */}
        <motion.div
          {...reveal(0.8)}
          className="flex gap-2 justify-center mt-2"
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Aller à la diapositive ${i + 1}`}
              aria-current={i === step}
              className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair/60 ${
                i === step
                  ? "w-10 bg-or-poudre-clair glow-pulse"
                  : "w-2 bg-creme-baobab/30 hover:bg-creme-baobab/50"
              }`}
            />
          ))}
        </motion.div>

        {/* Buttons — gradient fill + colored soft shadow + scale 0.97 on active */}
        <motion.div
          {...reveal(0.8)}
          className="flex gap-3 mt-4 items-center justify-center flex-wrap"
        >
          {step < slides.length - 1 ? (
            <>
              <button
                onClick={onComplete}
                className="link-passer text-creme-baobab/60 hover:text-creme-baobab/90 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair/40 rounded"
              >
                Passer
              </button>
              <button
                onClick={() => setStep(step + 1)}
                className="press px-7 py-3 rounded-full text-terre-brulee font-bold text-sm transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{
                  background: "linear-gradient(135deg, #FBF3E4 0%, #F4C77B 100%)",
                  boxShadow:
                    "0 6px 20px rgba(232, 155, 60, 0.30), 0 2px 6px rgba(199, 91, 60, 0.20)",
                }}
              >
                Suivant →
              </button>
            </>
          ) : (
            <button
              onClick={onComplete}
              className="press px-10 py-3.5 rounded-full text-terre-brulee font-bold text-base transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              style={{
                background: "linear-gradient(135deg, #FBF3E4 0%, #F4C77B 100%)",
                boxShadow:
                  "0 8px 28px rgba(232, 155, 60, 0.40), 0 2px 8px rgba(199, 91, 60, 0.25)",
              }}
            >
              Commencer ✨
            </button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default OnboardingGuard;
