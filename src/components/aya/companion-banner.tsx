"use client";

/**
 * Sankofa — Mode Compagnon : bannière + actions rapides
 *
 * CompanionBanner : bannière chaude en haut du chat, animation de pulsation
 *                   subtile, bouton de fermeture (X).
 * CompanionQuickActions : ligne de 4 boutons pill (en route / arrivé·e /
 *                         parler / arrêter).
 *
 * Hydration safety : Framer Motion `initial={false}` pour éviter tout
 * mismatch SSR/client. Aucun Date.now() au niveau module.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COMPANION_QUICK_ACTIONS,
  type CompanionState,
  type CompanionQuickAction,
} from "@/lib/companion";

interface CompanionBannerProps {
  state: CompanionState;
  onDismiss: () => void;
}

export function CompanionBanner({ state, onDismiss }: CompanionBannerProps) {
  const isCompleted = state.stage === "completed";
  const isCancelled = state.stage === "cancelled";
  const showDismiss = !isCompleted && !isCancelled;

  const label = isCompleted
    ? "Mode compagnon terminé — consultation sauvegardée 🌿"
    : isCancelled
      ? "Mode compagnon arrêté 🌿"
      : "Sankofa reste avec toi — mode compagnon actif";

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: 1,
        scale: isCompleted || isCancelled ? 1 : [1, 1.02, 1],
      }}
      transition={{
        opacity: { duration: 0.3 },
        scale: {
          duration: 3,
          repeat: isCompleted || isCancelled ? 0 : Infinity,
          ease: "easeInOut",
        },
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium",
        "bg-gradient-to-r from-terracotta/90 to-ocre-rouge/90",
        "border border-or-poudre-clair/40 text-text-on-dark",
        "rounded-lg shadow-md",
      )}
    >
      <span className="text-base shrink-0" aria-hidden="true">
        🌿
      </span>
      <span className="flex-1 truncate">{label}</span>
      {showDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Arrêter le mode compagnon"
          title="Arrêter le mode compagnon"
          className="shrink-0 size-6 rounded-full inline-flex items-center justify-center bg-or-poudre-clair/15 hover:bg-or-poudre-clair/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair"
        >
          <X className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}

interface CompanionQuickActionsProps {
  onAction: (action: CompanionQuickAction["id"]) => void;
  disabled?: boolean;
}

export function CompanionQuickActions({
  onAction,
  disabled,
}: CompanionQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Actions rapides du mode compagnon">
      {COMPANION_QUICK_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onAction(action.id)}
          disabled={disabled}
          aria-label={action.ariaLabel}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
            "bg-or-poudre-clair/20 hover:bg-or-poudre-clair/30 text-text-on-dark",
            "border border-or-poudre-clair/30",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <span aria-hidden="true">{action.emoji}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}
