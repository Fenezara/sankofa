"use client";

import * as React from "react";

/**
 * Sankofa — Logo emblème circulaire (V3 — aligned persona Aya)
 *
 * Composition :
 *   - Halo radial doré (glow chaud, peau caramel d'Aya)
 *   - Anneau externe : motif Adinkra géométrique (triangles + points) — pas juste pointillé
 *   - Cercle interne : dégradé chaud (wax rouge/orange/ambre/or)
 *   - Oiseau Sankofa stylisé : corps en cœur, tête tournée en arrière tenant un œuf
 *   - Œuf souligné (symbole central : la sagesse à préserver)
 *   - Animation (optionnelle) : la tête pivote légèrement (3s, ease-in-out)
 *
 * Palette alignée sur la persona Aya (VLM-analyzed) :
 *   - Peau caramel #8B5A3C, mahogany #6B4423 → inner gradient chaud
 *   - Wax rouge #C41E3A, ambre #FF6F00, or #FFD700 → accents
 *   - Crème wax #FFF8E1 → texte/œuf
 *
 * Symbole Adinkra : « San ko fa » = « Retourne et prends-le » — l'oiseau qui
 * récupère son œuf symbolise la sagesse de puiser dans le passé pour avancer.
 *
 * 3 tailles sm/md/lg via prop `size`. Hydration-safe : IDs uniques via useId.
 */

interface SankofaLogoProps {
  /** Taille en pixels. sm=24, md=40, lg=80. Defaut: 40. */
  size?: number;
  /** Anime la tête de l'oiseau (pivot subtil 3s). */
  animated?: boolean;
  /** Affiche le texte « SANKOFA » en arc de cercle (tailles ≥ 64px recommandé). */
  withText?: boolean;
  className?: string;
}

/**
 * 24 triangles rayonnants du motif Adinkra — précalculés UNE FOIS au chargement
 * du module (pas à chaque render). Arrondis à 4 décimales pour garantir des
 * strings identiques entre le serveur (Node.js) et le client (navigateur),
 * évitant ainsi les hydration mismatches liés aux différences de précision
 * flottante de Math.cos/Math.sin entre environnements.
 */
const ADINKRA_TRIANGLE_PATHS: string[] = Array.from({ length: 24 }, (_, i) => {
  const angle = (i * 360) / 24;
  const rad = (angle * Math.PI) / 180;
  const r1 = 55;
  const r2 = 51;
  const halfAngle = ((360 / 24) / 2) * (Math.PI / 180);
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const x1 = round(60 + r1 * Math.cos(rad));
  const y1 = round(60 + r1 * Math.sin(rad));
  const x2 = round(60 + r2 * Math.cos(rad - halfAngle));
  const y2 = round(60 + r2 * Math.sin(rad - halfAngle));
  const x3 = round(60 + r2 * Math.cos(rad + halfAngle));
  const y3 = round(60 + r2 * Math.sin(rad + halfAngle));
  return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`;
});

export function SankofaLogo({
  size = 40,
  animated = false,
  withText = false,
  className,
}: SankofaLogoProps) {
  const id = React.useId().replace(/:/g, "");
  // Texte seulement pour les grandes tailles (sinon illisible)
  const showText = withText && size >= 56;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-label="Sankofa — emblème Adinkra de l'oiseau qui regarde en arrière pour récupérer son œuf"
      role="img"
    >
      <defs>
        {/* === Dégradé chaud du cercle interne (aligné peau/wax d'Aya) === */}
        <linearGradient id={`skf-inner-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6B4423" />   {/* mahogany — peau base Aya */}
          <stop offset="30%" stopColor="#8B5A3C" />   {/* caramel — peau high Aya */}
          <stop offset="60%" stopColor="#A8451F" />   {/* terracotta — wax red orange */}
          <stop offset="85%" stopColor="#E89B3C" />   {/* ambre couchant */}
          <stop offset="100%" stopColor="#F4C77B" />  {/* or poudreclair */}
        </linearGradient>

        {/* === Dégradé de l'oiseau (ivoire/doré — feathers sur fond chaud) === */}
        <linearGradient id={`skf-bird-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8E1" />  {/* crème wax */}
          <stop offset="40%" stopColor="#F4C77B" />  {/* or */}
          <stop offset="80%" stopColor="#E89B3C" />  {/* ambre */}
          <stop offset="100%" stopColor="#D65430" />  {/* terracotta clair */}
        </linearGradient>

        {/* === Halo radial doré (glow peau caramel) === */}
        <radialGradient id={`skf-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F4C77B" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#E89B3C" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#E89B3C" stopOpacity="0" />
        </radialGradient>

        {/* Chemin circulaire pour le texte en arc */}
        {showText && (
          <path
            id={`skf-text-path-${id}`}
            d="M 60 60 m -50 0 a 50 50 0 1 1 100 0"
            fill="none"
          />
        )}
      </defs>

      {/* === Halo doré === */}
      <circle cx="60" cy="60" r="60" fill={`url(#skf-glow-${id})`} />

      {/* === Anneau externe Adinkra géométrique (V3 — triangles + points) === */}
      {/* Bordure externe ocre-rouge */}
      <circle cx="60" cy="60" r="57" fill="none" stroke="#7A2E12" strokeWidth="1.5" />

      {/* Anneau avec triangles rayonnants (motif Adinkra authentique) */}
      <g stroke="#A8451F" strokeWidth="1" fill="none" strokeLinejoin="round">
        {ADINKRA_TRIANGLE_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* Liseré doré fin */}
      <circle cx="60" cy="60" r="48.5" fill="none" stroke="#F4C77B" strokeWidth="0.7" opacity="0.75" />

      {/* === Cercle interne avec dégradé chaud === */}
      <circle cx="60" cy="60" r="46" fill={`url(#skf-inner-${id})`} />

      {/* Motif pointillé subtil à l'intérieur du cercle (texture Adinkra) */}
      <circle
        cx="60"
        cy="60"
        r="44"
        fill="none"
        stroke="#FFF8E1"
        strokeWidth="0.4"
        strokeDasharray="0.5 2"
        opacity="0.3"
      />

      {/* === Texte SANKOFA en arc de cercle (optionnel) === */}
      {showText && (
        <text
          fill="#FFF8E1"
          fontSize="5.5"
          fontWeight="700"
          letterSpacing="3.5"
          fontFamily="var(--font-bricolage), ui-sans-serif, system-ui, sans-serif"
        >
          <textPath href={`#skf-text-path-${id}`} startOffset="50%" textAnchor="middle">
            SANKOFA
          </textPath>
        </text>
      )}

      {/* === Oiseau Sankofa stylisé (centré sur 60,60) === */}
      <g transform="translate(60, 60)">
        {/* === Queue (en bas à droite) === */}
        <path
          d="M 14 16 C 22 18, 28 14, 30 8 C 27 12, 22 12, 16 12 C 18 8, 18 4, 16 2 Z"
          fill={`url(#skf-bird-${id})`}
          stroke="#3D1A0E"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Plumes de queue (lignes fines) */}
        <path
          d="M 18 14 L 26 10 M 19 11 L 27 7 M 18 8 L 24 4"
          stroke="#3D1A0E"
          strokeWidth="0.5"
          fill="none"
          opacity="0.5"
        />

        {/* === Corps en cœur (forme caractéristique du Sankofa) === */}
        <path
          d="M -16 4 C -18 -10, -10 -18, -2 -14 C 6 -18, 16 -10, 14 4 C 14 14, 6 22, -2 26 C -10 22, -16 14, -16 4 Z"
          fill={`url(#skf-bird-${id})`}
          stroke="#3D1A0E"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Détail de l'aile (courbe intérieure) */}
        <path
          d="M -10 -2 C -6 -4, -2 -4, 2 -2 C 6 -4, 10 -2, 12 2 C 8 6, 4 10, 0 12 C -4 10, -8 6, -10 -2 Z"
          fill="#D65430"
          stroke="#3D1A0E"
          strokeWidth="0.7"
          opacity="0.6"
        />
        {/* Plumes de l'aile (lignes décoratives) */}
        <path
          d="M -6 0 L 4 6 M -2 -2 L 8 4 M 2 -2 L 10 2"
          stroke="#3D1A0E"
          strokeWidth="0.4"
          fill="none"
          opacity="0.45"
        />

        {/* === Tête + cou qui regarde en arrière (animé) === */}
        <g
          style={
            animated
              ? {
                  transformOrigin: "-14px -8px",
                  animation: `skf-head-${id} 3s ease-in-out infinite`,
                }
              : undefined
          }
        >
          {/* Cou courbé vers l'arrière */}
          <path
            d="M -12 -8 C -20 -14, -28 -10, -30 -4 C -31 -1, -29 2, -25 3 C -21 3, -17 1, -14 -2 C -13 -4, -13 -6, -12 -8 Z"
            fill={`url(#skf-bird-${id})`}
            stroke="#3D1A0E"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {/* Tête ronde */}
          <circle
            cx="-26"
            cy="-4"
            r="5.5"
            fill={`url(#skf-bird-${id})`}
            stroke="#3D1A0E"
            strokeWidth="1"
          />
          {/* Crête (petite huppe sur la tête) */}
          <path
            d="M -28 -10 C -27 -12, -25 -12, -24 -10"
            stroke="#3D1A0E"
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
          />
          {/* Œil */}
          <circle cx="-27.5" cy="-5" r="1.4" fill="#3D1A0E" />
          <circle cx="-27" cy="-5.5" r="0.5" fill="#FFF8E1" />
          {/* Bec */}
          <path
            d="M -31 -3 L -35.5 -2 L -31 0.5 Z"
            fill="#F4C77B"
            stroke="#3D1A0E"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />

          {/* === Œuf tenu dans le bec (symbole central du Sankofa) === */}
          <ellipse
            cx="-37.5"
            cy="-1.5"
            rx="3"
            ry="3.6"
            fill="#FFF8E1"
            stroke="#3D1A0E"
            strokeWidth="0.7"
          />
          {/* Reflet sur l'œuf */}
          <ellipse cx="-38.5" cy="-3" rx="0.9" ry="1.3" fill="#FFFFFF" opacity="0.75" />
          {/* Petites taches dorées sur l'œuf (texture) */}
          <circle cx="-36.5" cy="-0.5" r="0.4" fill="#E89B3C" opacity="0.6" />
          <circle cx="-38" cy="0.5" r="0.3" fill="#D65430" opacity="0.5" />
        </g>

        {/* === Pattes === */}
        <line x1="-4" y1="26" x2="-6" y2="34" stroke="#3D1A0E" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="4" y1="26" x2="6" y2="34" stroke="#3D1A0E" strokeWidth="1.5" strokeLinecap="round" />
        {/* Doigts (pattes) */}
        <path d="M -8 34 L -6 34 L -4 34 M -6 34 L -6 36" stroke="#3D1A0E" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M 4 34 L 6 34 L 8 34 M 6 34 L 6 36" stroke="#3D1A0E" strokeWidth="1" fill="none" strokeLinecap="round" />
      </g>

      {/* === Style de l'animation (injecté avec ID unique) === */}
      {animated && (
        <style>{`
          @keyframes skf-head-${id} {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(-12deg); }
          }
        `}</style>
      )}
    </svg>
  );
}

export default SankofaLogo;
