/**
 * Sankofa — Symboles Adinkra (tradition Akan, Côte d'Ivoire / Ghana)
 *
 * 7 symboles exportés en composants SVG inline, stroke-based, recolorables via `currentColor`.
 *
 * Significations :
 *  - AyaSymbol        : la fougère, endurance, résilience (symbole de la marque)
 *  - SankofaSymbol    : oiseau regardant en arrière, retour aux sources, mémoire
 *  - GyeNyameSymbol   : carré + croix, suprématie de Dieu, confiance / protection
 *  - MateMasieSymbol  : deux losanges, "j'ai bien entendu", écoute, consentement
 *  - OsramSymbol      : lune + étoile, nuit, urgences, veille
 *  - DuafeSymbol      : peigne, féminité, santé des femmes
 *  - AnanseSymbol     : toile d'araignée, réseau, savoir, centres de santé
 *
 * Sources : tradition orale Akan, motifs Adinkradocumentés (Ghana/Côte d'Ivoire).
 */

import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  /** Taille du viewBox carré (default 48) */
  size?: number;
  /** Épaisseur du trait (default 2.2) */
  strokeWidth?: number;
  /** Si true, anime le stroke-dashoffset sur mount (effet "dessin") */
  animate?: boolean;
};

function withAdinkraProps(Wrapped: React.FC<IconProps>) {
  return Wrapped;
}

const baseProps = (
  size = 48,
  strokeWidth = 2.2,
  animate = false,
): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
  className: animate ? "aya-adinkra aya-adinkra-anim" : "aya-adinkra",
});

/** Sankofa — la fougère (endurance, résilience). Symbole de la marque. */
export const AyaSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Tige centrale */}
    <path d="M24 44 L24 16" />
    {/* Feuilles symétriques (3 paires) */}
    <path d="M24 38 C 18 36, 14 32, 14 26" />
    <path d="M24 38 C 30 36, 34 32, 34 26" />
    <path d="M24 30 C 19 28, 16 25, 16 20" />
    <path d="M24 30 C 29 28, 32 25, 32 20" />
    <path d="M24 22 C 20 20, 18 17, 18 13" />
    <path d="M24 22 C 28 20, 30 17, 30 13" />
    {/* Spiralée (fronde) en tête */}
    <path d="M24 16 C 22 12, 24 8, 28 9 C 31 10, 30 14, 27 14 C 25 14, 25 12, 26 11" />
    {/* Racines */}
    <path d="M24 44 C 22 46, 20 46, 19 45" />
    <path d="M24 44 C 26 46, 28 46, 29 45" />
  </svg>
);

/** Sankofa — oiseau regardant en arrière (retour aux sources, mémoire). */
export const SankofaSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Corps de l'oiseau stylisé regardant en arrière */}
    <path d="M14 36 C 12 30, 14 24, 20 22 C 24 21, 28 23, 30 26" />
    {/* Tête regardant en arrière */}
    <path d="M30 26 C 32 23, 32 19, 28 18 C 24 17, 22 20, 22 23" />
    {/* Bec pointant vers l'arrière */}
    <path d="M22 23 L 18 22 L 22 25" />
    {/* Patte */}
    <path d="M20 36 L 20 42 M 20 42 L 17 44 M 20 42 L 23 44" />
    {/* Queue */}
    <path d="M14 36 C 10 35, 8 33, 9 30" />
    {/* Œil */}
    <circle cx="26" cy="22" r="1" fill="currentColor" stroke="none" />
    {/* Heart symbol (ancestral) */}
    <path d="M36 36 C 34 33, 30 33, 30 36 C 30 33, 32 30, 36 32" />
  </svg>
);

/** Gye Nyame — carré + croix (suprématie de Dieu, confiance, protection). */
export const GyeNyameSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Carré extérieur (style Adinkra spiral) */}
    <path d="M10 10 L 38 10 L 38 38 L 10 38 Z" />
    {/* Croix intérieure spiralée */}
    <path d="M24 10 L 24 38" />
    <path d="M10 24 L 38 24" />
    {/* Spirales aux 4 coins (motif caractéristique Gye Nyame) */}
    <path d="M10 10 C 14 12, 14 16, 10 18 C 6 16, 6 12, 10 10 Z" />
    <path d="M38 10 C 34 12, 34 16, 38 18 C 42 16, 42 12, 38 10 Z" />
    <path d="M10 38 C 14 36, 14 32, 10 30 C 6 32, 6 36, 10 38 Z" />
    <path d="M38 38 C 34 36, 34 32, 38 30 C 42 32, 42 36, 38 38 Z" />
    {/* Cercle central */}
    <circle cx="24" cy="24" r="3" />
  </svg>
);

/** Mate Masie — deux losanges ("j'ai bien entendu", écoute, consentement). */
export const MateMasieSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Losange haut */}
    <path d="M24 6 L 36 14 L 24 22 L 12 14 Z" />
    {/* Losange bas */}
    <path d="M24 26 L 36 34 L 24 42 L 12 34 Z" />
    {/* Lien central */}
    <path d="M24 22 L 24 26" />
    {/* Points de "parole" */}
    <circle cx="24" cy="14" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="24" cy="34" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

/** Osram Ne Nsoromma — lune + étoile (nuit, urgences, veille). */
export const OsramSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Croissant de lune */}
    <path d="M30 10 C 22 10, 16 16, 16 24 C 16 32, 22 38, 30 38 C 26 36, 22 30, 22 24 C 22 18, 26 12, 30 10 Z" />
    {/* Étoile à 5 branches */}
    <path d="M34 24 L 35.5 27.5 L 39 28 L 36.5 30.5 L 37 34 L 34 32.5 L 31 34 L 31.5 30.5 L 29 28 L 32.5 27.5 Z" />
    {/* Petit point lumineux */}
    <circle cx="36" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

/** Duafe — peigne (féminité, santé des femmes). */
export const DuafeSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Cadre supérieur du peigne */}
    <path d="M10 18 L 38 18 L 38 28 L 30 28 L 30 26 L 18 26 L 18 28 L 10 28 Z" />
    {/* Dents du peigne */}
    <path d="M13 28 L 13 42" />
    <path d="M17 28 L 17 42" />
    <path d="M21 28 L 21 42" />
    <path d="M25 28 L 25 42" />
    <path d="M29 28 L 29 42" />
    <path d="M33 28 L 33 42" />
    {/* Décoration supérieure */}
    <circle cx="24" cy="13" r="3" />
    <path d="M21 13 L 10 13" />
    <path d="M27 13 L 38 13" />
  </svg>
);

/** Ananse Nton — toile d'araignée (réseau, savoir, centres de santé connectés). */
export const AnanseSymbol: React.FC<IconProps> = ({
  size = 48,
  strokeWidth = 2.2,
  animate = false,
  ...rest
}) => (
  <svg {...baseProps(size, strokeWidth, animate)} {...rest}>
    {/* Rayons */}
    <path d="M24 6 L 24 42" />
    <path d="M6 24 L 42 24" />
    <path d="M11 11 L 37 37" />
    <path d="M37 11 L 11 37" />
    {/* Anneaux concentriques */}
    <path d="M24 12 C 30 12, 36 18, 36 24 C 36 30, 30 36, 24 36 C 18 36, 12 30, 12 24 C 12 18, 18 12, 24 12 Z" />
    <path d="M24 18 C 27 18, 30 21, 30 24 C 30 27, 27 30, 24 30 C 21 30, 18 27, 18 24 C 18 21, 21 18, 24 18 Z" />
    {/* Araignée centrale stylisée */}
    <circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none" />
    <path d="M24 22 L 22 18" />
    <path d="M24 22 L 26 18" />
    <path d="M24 26 L 22 30" />
    <path d="M24 26 L 26 30" />
  </svg>
);

/** Composant agrégé (rarement utilisé, mais pratique). */
export const AdinkraSymbols = {
  Aya: AyaSymbol,
  Sankofa: SankofaSymbol,
  GyeNyame: GyeNyameSymbol,
  MateMasie: MateMasieSymbol,
  Osram: OsramSymbol,
  Duafe: DuafeSymbol,
  Ananse: AnanseSymbol,
};

export default withAdinkraProps;
