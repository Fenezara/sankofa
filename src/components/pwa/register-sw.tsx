"use client";

/**
 * Sankofa — PWA Service Worker registration
 *
 * Enregistre /sw.js côté client uniquement, après le mount (évite les
 * soucis de hydration). Gère :
 *  - Enregistrement initial
 *  - Skip waiting sur update (active immédiatement la nouvelle version)
 *  - Toast "Nouvelle version disponible — recharger"
 *  - Updatefound / controllerchange
 */

import * as React from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_PROMPT_KEY = "aya:beforeinstallprompt";

/**
 * Hook global : enregistre le SW et expose l'événement beforeinstallprompt
 * via un event listener, stocké sur window pour être consommé par
 * <InstallButton />.
 */
export function RegisterSW() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let registered = false;

    const register = async () => {
      try {
        // En dev, on unregister tous les SW pour éviter les hydration mismatches
        // causés par le cache stale du SW.
        if (process.env.NODE_ENV === "development") {
          const existingRegs = await navigator.serviceWorker.getRegistrations();
          for (const reg of existingRegs) {
            await reg.unregister();
          }
          // Clear tous les caches
          if ("caches" in window) {
            const keys = await caches.keys();
            for (const key of keys) {
              await caches.delete(key);
            }
          }
          return; // Ne pas enregistrer le SW en dev
        }

        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        registered = true;

        // Update trouvée
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              toast.info("Nouvelle version disponible", {
                description: "Recharger pour activer les nouveautés.",
                action: {
                  label: "Recharger",
                  onClick: () => {
                    newWorker.postMessage?.("SKIP_WAITING");
                    setTimeout(() => window.location.reload(), 300);
                  },
                },
                duration: 8000,
              });
            }
          });
        });

        // controller change (nouveau SW activé)
        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });

        // Vérifie les mises à jour toutes les 60 min
        setInterval(() => {
          reg.update().catch(() => {
            // ignore
          });
        }, 60 * 60 * 1000);
      } catch (err) {
        console.warn("[Sankofa PWA] SW registration échouée:", err);
      }
    };

    register();

    // Capture beforeinstallprompt pour exposer au InstallButton
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent("aya-installable"));
    };

    const onAppInstalled = () => {
      (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] = null;
      window.dispatchEvent(new CustomEvent("aya-installed"));
      toast.success("Sankofa est installée 🎉", {
        description: "Tu peux la lancer depuis ton écran d'accueil.",
      });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      void registered;
    };
  }, []);

  return null;
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] as BeforeInstallPromptEvent | null;
}

export function clearDeferredPrompt() {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] = null;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}
