"use client";

/**
 * Sankofa — Cauris (coquillage de cauri)
 *
 * Forme de coquillage utilisée pour les chips de suggestions dans le chat.
 * Le cauri symbolise la richesse, la rareté, et la transmission en tradition Akan.
 */

import * as React from "react";

interface CaurisChipProps {
  children: React.ReactNode;
  /** Emoji ou pictogramme affiché à gauche */
  emoji?: string;
  /** Fonction appelée au clic */
  onClick?: () => void;
  /** État désactivé */
  disabled?: boolean;
  className?: string;
}

export function CaurisChip({
  children,
  emoji,
  onClick,
  disabled = false,
  className,
}: CaurisChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group cauris-chip-premium relative inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium
        text-text-on-light bg-or-poudre-clair/40
        border border-ocre-rouge/40 rounded-[40%_/_60%]
        shadow-sm
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1
        ${className ?? ""}`}
      aria-disabled={disabled}
    >
      {/* Petit cauri SVG en fond */}
      <svg
        aria-hidden="true"
        className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 transition-opacity"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 2 C 6 6, 4 14, 6 20 C 9 22, 15 22, 18 20 C 20 14, 18 6, 12 2 Z" />
        <path d="M12 3 L 12 21" strokeDasharray="2 1" />
      </svg>
      {emoji && (
        <span aria-hidden="true" className="text-sm">
          {emoji}
        </span>
      )}
      <span className="text-left">{children}</span>
    </button>
  );
}

export default CaurisChip;
