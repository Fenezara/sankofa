"use client";

/**
 * Sankofa — Install button (PWA V3)
 *
 * Bouton flottant bas-droit (au-dessus du footer) qui apparaît quand
 * l'événement beforeinstallprompt est capturé. Caché après install ou
 * si déjà installé (display-mode: standalone).
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";
import { toast } from "sonner";

import {
  getDeferredPrompt,
  clearDeferredPrompt,
  isStandalone,
} from "./register-sw";

interface DeferredPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const [promptAvailable, setPromptAvailable] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Déjà installé ?
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    // Vérifie si prompt déjà capturé
    const checkExisting = () => {
      const existing = getDeferredPrompt() as DeferredPrompt | null;
      if (existing) setPromptAvailable(true);
    };
    checkExisting();

    const onInstallable = () => setPromptAvailable(true);
    const onInstalled = () => {
      setInstalled(true);
      setPromptAvailable(false);
    };

    window.addEventListener("aya-installable", onInstallable);
    window.addEventListener("aya-installed", onInstalled);
    return () => {
      window.removeEventListener("aya-installable", onInstallable);
      window.removeEventListener("aya-installed", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const deferred = getDeferredPrompt() as DeferredPrompt | null;
    if (!deferred) {
      toast.info("Installation pas encore disponible", {
        description: "Continue à utiliser Sankofa, l'option apparaîtra bientôt.",
      });
      return;
    }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      clearDeferredPrompt();
      setPromptAvailable(false);
    } catch (err) {
      toast.error("Installation impossible", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const show = promptAvailable && !installed;

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={handleInstall}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          aria-label="Installer l'application Sankofa sur ton téléphone"
          className="fixed top-16 right-3 z-40 flex items-center gap-2 rounded-full bg-terracotta text-creme-baobab px-3 py-2 shadow-lg border border-or-poudre-clair/30 aya-btn-press"
        >
          <Download className="size-5" aria-hidden="true" />
          <span className="text-sm font-bold" style={{ fontFamily: "var(--font-bricolage)" }}>
            Installer Sankofa
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default InstallButton;
