/**
 * Sankofa — Bordure Kita (motif géométrique répété, inspiration kente)
 *
 * Utilisation : bordure décorative haute ou basse sur les cartes, sections, dialogues.
 * Implémenté comme un composant SVG inline pour rester léger (~1 KB) et recolorable.
 */

import * as React from "react";

interface KitaBorderProps {
  /** Épaisseur en px (default 6) */
  thickness?: number;
  /** Couleur 1 (default ocre-rouge) */
  color1?: string;
  /** Couleur 2 (default ambre-couchant) */
  color2?: string;
  /** Couleur 3 (default terracotta) */
  color3?: string;
  /** Couleur 4 (default or-poudré) */
  color4?: string;
  className?: string;
  "aria-hidden"?: boolean;
}

export function KitaBorder({
  thickness = 6,
  color1 = "#9B3F1F",
  color2 = "#E89B3C",
  color3 = "#C75B3C",
  color4 = "#F4C77B",
  className,
  ...rest
}: KitaBorderProps) {
  // Le pattern fait 40px de large, on le répète sur toute la largeur via preserveAspectRatio none
  return (
    <svg
      role="presentation"
      aria-hidden={rest["aria-hidden"] ?? true}
      className={className}
      width="100%"
      height={thickness}
      viewBox="0 0 40 8"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="aya-kita-pattern"
          x="0"
          y="0"
          width="40"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width="8" height="8" fill={color1} />
          <rect x="8" y="0" width="4" height="8" fill={color2} />
          <rect x="12" y="0" width="4" height="8" fill={color3} />
          <rect x="16" y="0" width="8" height="8" fill={color4} />
          <rect x="24" y="0" width="4" height="8" fill="#7B4B5C" />
          <rect x="28" y="0" width="4" height="8" fill={color1} />
          <rect x="32" y="0" width="8" height="8" fill={color2} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#aya-kita-pattern)" />
    </svg>
  );
}

export default KitaBorder;
