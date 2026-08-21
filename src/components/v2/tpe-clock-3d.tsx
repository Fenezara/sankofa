"use client";

/**
 * Sankofa — TPE Clock 3D (V3)
 *
 * - Disque 3D avec profondeur multicouche (ombre, disque, reflet)
 * - Pulse animation sur le segment "temps écoulé → 72h"
 * - 4 symboles Adinkra (Osram) autour du disque, rotation lente
 * - Couleur de l'arc de progression selon le temps restant (vert → ambre → rouge)
 * - Légende enrichie
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { OsramSymbol } from "@/components/cultural/adinkra-symbols";

interface TpeClock3DProps {
  /** Heures écoulées (0-72). Default 24 (démo). */
  hoursElapsed?: number;
  /** Total d'heures (default 72) */
  totalHours?: number;
  className?: string;
}

export function TpeClock3D({
  hoursElapsed = 24,
  totalHours = 72,
  className,
}: TpeClock3DProps) {
  const shouldReduceMotion = useReducedMotion();
  const progress = Math.min(1, Math.max(0, hoursElapsed / totalHours));
  const remainingHours = Math.max(0, totalHours - hoursElapsed);

  // Couleur de l'arc selon temps restant
  // 72h → 48h : vert baobab (#2D4A2D)
  // 48h → 24h : ambre couchant (#8B5A14)
  // 24h → 0h  : ocre rouge (#7A2E12)
  const progressColor =
    remainingHours >= 48 ? "#2D4A2D" : remainingHours >= 24 ? "#8B5A14" : "#7A2E12";

  // Background tint selon temps restant
  const bgTint =
    remainingHours >= 48
      ? "rgba(45, 74, 45, 0.06)"
      : remainingHours >= 24
        ? "rgba(139, 90, 20, 0.06)"
        : "rgba(122, 46, 18, 0.08)";

  // 72 graduations
  const graduations = React.useMemo(
    () =>
      Array.from({ length: totalHours }, (_, i) => {
        const angle = (i / totalHours) * 360;
        let color = "#2D4A2D"; // vert-baobab (0-2h)
        if (i >= 2 && i < 24) color = "#8B5A14"; // ambre-couchant
        else if (i >= 24 && i < 48) color = "#7A2E12"; // ocre-rouge
        else if (i >= 48) color = "#3D1A0E"; // terre-brulee
        const isMajor = i % 6 === 0;
        const isPassed = i < hoursElapsed;
        // Le segment "actif" (entre hoursElapsed et la limite haute de la zone courante) pulse
        const isActive =
          i === Math.floor(hoursElapsed) ||
          (i >= hoursElapsed && i < hoursElapsed + 1);
        return { angle, color, isMajor, isPassed, isActive, idx: i };
      }),
    [hoursElapsed, totalHours],
  );

  // Position des 4 Osram autour du disque
  const adinkraPositions = [
    { angle: 0, label: "N" },
    { angle: 90, label: "E" },
    { angle: 180, label: "S" },
    { angle: 270, label: "W" },
  ];

  return (
    <div
      className={`relative ${className ?? ""}`}
      role="img"
      aria-label={`Chronomètre TPE 72 heures : ${hoursElapsed} heures écoulées sur ${totalHours}, ${remainingHours} heures restantes`}
    >
      {/* Container avec perspective — overflow-hidden pour empêcher les symboles
          orbitants (r=175px) de déborder et causer un décalage horizontal sur mobile */}
      <div
        className="aya-perspective-far mx-auto relative overflow-hidden rounded-full"
        style={{ width: 360, maxWidth: "100%", padding: 40 }}
      >
        {/* Halo glow autour du disque */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${bgTint} 0%, transparent 70%)`,
            transform: "scale(1.3)",
          }}
        />

        {/* 4 Osram symbols qui tournent lentement autour du disque */}
        <div
          aria-hidden="true"
          className={shouldReduceMotion ? "" : "aya-rotate-slow"}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          {adinkraPositions.map((pos) => {
            const rad = ((pos.angle - 90) * Math.PI) / 180;
            const r = 175;
            const x = Math.cos(rad) * r;
            const y = Math.sin(rad) * r;
            return (
              <div
                key={pos.label}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              >
                {/* Contre-rotation pour que le symbole reste droit */}
                <div className={shouldReduceMotion ? "" : "aya-rotate-slow-reverse"}>
                  <OsramSymbol size={32} strokeWidth={1.8} color="#9B3F1F" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Disque 3D principal */}
        <motion.div
          initial={shouldReduceMotion ? false : { rotateX: 25, opacity: 0, scale: 0.9 }}
          whileInView={{ rotateX: 18, opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="relative aspect-square aya-3d-flat mx-auto"
          style={{ transformStyle: "preserve-3d", width: 280, maxWidth: "100%" }}
        >
          {/* Disque profondeur (ombre très en arrière) */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: "#1A0905",
              backgroundImage:
                "radial-gradient(circle at 35% 35%, #2A1810 0%, #1A0F0A 70%, #0A0503 100%)",
              boxShadow: "0 30px 60px rgba(26, 15, 10, 0.55), 0 0 40px rgba(232, 155, 60, 0.15)",
              transform: "translateZ(-15px) scale(1.04)",
            }}
          />
          {/* Disque intermédiaire (couche d'ombre projetée) */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, #3A1810 0%, #2A1108 80%)",
              transform: "translateZ(-8px) scale(1.02)",
            }}
            aria-hidden="true"
          />

          {/* Disque de couleur (avec dégradé par zones) */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 w-full h-full"
            style={{ transform: "translateZ(0px)" }}
          >
            <defs>
              <radialGradient id="aya-tpe-glow-v3" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F4C77B" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#5C2A1A" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="aya-tpe-disc-v3" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#3A1810" stopOpacity="1" />
                <stop offset="60%" stopColor="#2A1108" stopOpacity="1" />
                <stop offset="100%" stopColor="#1A0905" stopOpacity="1" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="92" fill="url(#aya-tpe-glow-v3)" />
            <circle cx="100" cy="100" r="90" fill="url(#aya-tpe-disc-v3)" />
            <circle cx="100" cy="100" r="90" fill="none" stroke="#2D1810" strokeWidth="2" />

            {/* Graduations */}
            {graduations.map((g) => {
              const rad = ((g.angle - 90) * Math.PI) / 180;
              const r1 = g.isMajor ? 70 : 78;
              const r2 = 86;
              return (
                <line
                  key={g.idx}
                  x1={100 + Math.cos(rad) * r1}
                  y1={100 + Math.sin(rad) * r1}
                  x2={100 + Math.cos(rad) * r2}
                  y2={100 + Math.sin(rad) * r2}
                  stroke={g.color}
                  strokeWidth={g.isMajor ? 2.6 : 1.3}
                  opacity={g.isPassed ? 1 : 0.4}
                  strokeLinecap="round"
                  className={g.isActive && !shouldReduceMotion ? "aya-segment-pulse" : ""}
                />
              );
            })}

            {/* Arc de progression (heure écoulée) — pulse */}
            <circle
              cx="100"
              cy="100"
              r="82"
              fill="none"
              stroke={progressColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2 * Math.PI * 82} ${2 * Math.PI * 82}`}
              transform="rotate(-90 100 100)"
              opacity="0.95"
              className={!shouldReduceMotion ? "aya-segment-pulse" : ""}
              style={{ filter: `drop-shadow(0 0 6px ${progressColor})` }}
            />

            {/* Indicateur (aiguille) */}
            <line
              x1="100"
              y1="100"
              x2={100 + Math.cos((progress * 360 - 90) * (Math.PI / 180)) * 76}
              y2={100 + Math.sin((progress * 360 - 90) * (Math.PI / 180)) * 76}
              stroke="#F4C77B"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 4px rgba(244, 199, 123, 0.8))" }}
            />
            <circle cx="100" cy="100" r="7" fill="#F4C77B" />
            <circle cx="100" cy="100" r="3.5" fill="#5C2A1A" />
          </svg>

          {/* Texte central */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none rounded-full"
            style={{ transform: "translateZ(25px)", backgroundColor: "rgba(26, 9, 5, 0.92)" }}
          >
            <span
              className="text-5xl sm:text-6xl font-extrabold text-text-accent-on-dark"
              style={{ fontFamily: "var(--font-bricolage)", textShadow: "0 2px 12px rgba(0,0,0,0.5), 0 0 24px rgba(232, 155, 60, 0.35)" }}
            >
              {hoursElapsed}h
            </span>
            <span className="text-xs uppercase tracking-widest text-text-on-dark-soft mt-1">
              / {totalHours}h
            </span>
            <span className="text-[10px] text-text-on-dark-muted mt-2 px-3 text-center">
              {remainingHours}h restantes
            </span>
          </div>

          {/* Reflet brillant haut-gauche */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.20) 100%)",
              transform: "translateZ(35px)",
            }}
          />
        </motion.div>
      </div>

      {/* Légende des zones */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
        {[
          { label: "0-2h", sublabel: "Idéal", color: "#2D4A2D" },
          { label: "2-24h", sublabel: "Très bon", color: "#8B5A14" },
          { label: "24-48h", sublabel: "Possible", color: "#7A2E12" },
          { label: "48-72h", sublabel: "Dernier délai", color: "#3D1A0E" },
        ].map((zone) => (
          <div
            key={zone.label}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/60 border border-ocre-rouge/20 aya-lift"
            style={{ boxShadow: "0 1px 3px rgba(92, 42, 26, 0.06)" }}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: zone.color }}
            />
            <div className="leading-tight">
              <div className="font-semibold text-text-on-light">{zone.label}</div>
              <div className="text-text-on-light-muted">{zone.sublabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TpeClock3D;
