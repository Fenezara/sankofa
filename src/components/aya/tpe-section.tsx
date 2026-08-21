"use client";

/**
 * Sankofa — Tab TPE 72h (V3 — perfectionné)
 *
 * - En-tête simple : "TPE 72h" / "Le chrono qui sauve"
 * - Card horloge (centrée + visible)
 * - Centres TPE : 📍 + nom + spécialité + bouton Appeler (tel:) + bouton Itinéraire (Google Maps)
 * - Calendrier de suivi : timeline verticale avec cercles numérotés + lignes de connexion
 * - CTA plan d'action bien visible en bas avec icône
 */

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Phone,
  MapPin,
  Calendar,
  Zap,
  FileText,
  Clock,
  Navigation,
} from "lucide-react";

const TpeClock3D = dynamic(
  () => import("@/components/v2/tpe-clock-3d").then((m) => m.TpeClock3D),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto rounded-full bg-gradient-to-br from-ocre-rouge/15 to-terre-brulee/15 border-2 border-ocre-rouge/25 flex items-center justify-center"
        style={{ width: 220, maxWidth: "100%", aspectRatio: "1 / 1" }}
        aria-label="Chargement du chronomètre TPE..."
      >
        <div className="text-center">
          <div
            className="text-3xl font-black text-terracotta animate-pulse"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            72h
          </div>
          <div className="text-[11px] text-ocre-rouge/70 mt-1">Chargement...</div>
        </div>
      </div>
    ),
  },
);

interface TpeSectionProps {
  onActivatePlan: () => void;
}

const CENTERS = [
  {
    name: "CHU Cocody",
    sub: "Urgences · 24h/24",
    phone: "+225 27 22 44 00 00",
    note: "TPE délivré aux urgences",
    city: "Abidjan Cocody",
  },
  {
    name: "Hôpital Treichville",
    sub: "Maternité · 24h/24",
    phone: "+225 27 21 30 00 00",
    note: "Service maternité — présente-toi sans RDV",
    city: "Abidjan Treichville",
  },
  {
    name: "AIBEF Abidjan",
    sub: "Gratuit pour les jeunes",
    phone: "+225 27 22 44 60 60",
    note: "SSR, contraception, TPE gratuit",
    city: "Abidjan",
  },
  {
    name: "CHU Yopougon",
    sub: "Urgences · 24h/24",
    phone: "+225 27 23 33 00 00",
    note: "Service des urgences",
    city: "Abidjan Yopougon",
  },
];

const TIMELINE_STEPS = [
  {
    period: "J0",
    title: "Début TPE",
    description: "1ère prise dans les 72h après le rapport à risque.",
    color: "#2D4A2D",
    number: 1,
  },
  {
    period: "S2",
    title: "1er test VIH",
    description: "Test de contrôle à 2 semaines. Tolérance au traitement.",
    color: "#8B5A14",
    number: 2,
  },
  {
    period: "S6",
    title: "2e test VIH",
    description: "Test à 6 semaines. Confirme l'efficacité du TPE.",
    color: "#A8451F",
    number: 3,
  },
  {
    period: "M3",
    title: "Test final",
    description: "Test définitif à 3 mois. Si négatif, tu es tranquille.",
    color: "#7A2E12",
    number: 4,
  },
];

export function TpeSection({ onActivatePlan }: TpeSectionProps) {
  // Heures écoulées depuis le rapport à risque — démo 24h
  const hoursElapsed = 24;
  const totalHours = 72;
  const remainingHours = Math.max(0, totalHours - hoursElapsed);

  return (
    <div className="flex flex-col">
      {/* En-tête simple */}
      <div className="px-4 py-3 border-b border-ocre-rouge/10 bg-creme-baobab shrink-0">
        <h1
          className="text-xl font-bold text-terre-brulee"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          TPE 72h
        </h1>
        <p className="text-xs text-ocre-rouge/60 mt-0.5">Le chrono qui sauve</p>
      </div>

      {/* Zone de contenu scrollable — overflow-x-hidden empêche le décalage horizontal */}
      <div className="flex-1 min-h-0 overflow-x-hidden px-4 py-4 space-y-4">
        {/* === Card horloge — bien centrée et visible === */}
        <div className="sankofa-card rounded-2xl p-5">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className="size-4 text-terracotta" />
            <h2 className="text-sm font-bold text-terre-brulee" style={{ fontFamily: "var(--font-bricolage)" }}>
              Chronomètre 72h
            </h2>
          </div>
          {/* Horloge centrée */}
          <div className="flex justify-center">
            <TpeClock3D hoursElapsed={hoursElapsed} totalHours={totalHours} />
          </div>
          <div className="mt-4 text-center">
            <div
              className="text-3xl font-black text-terre-brulee"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {hoursElapsed}h
              <span className="text-lg font-semibold text-ocre-rouge/60"> / {totalHours}h</span>
            </div>
            <p className="text-[11px] text-ocre-rouge/70 mt-0.5">
              {remainingHours}h restantes · démo
            </p>
          </div>
          <p className="mt-3 text-xs text-ocre-rouge/80 text-center italic">
            Plus tôt tu démarres le TPE, plus il est efficace. Idéalement dans les 2h.
          </p>
        </div>

        {/* === Centres TPE — 📍 + tel: + Itinéraire === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Centres TPE
          </h3>
          <div className="space-y-3">
            {CENTERS.map((center) => (
              <div
                key={center.name}
                className="sankofa-card rounded-2xl p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="shrink-0 size-9 rounded-lg bg-terracotta/12 flex items-center justify-center mt-0.5">
                    <MapPin className="size-4 text-terracotta" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-terre-brulee truncate">{center.name}</p>
                    <p className="text-[11px] text-ocre-rouge/80">{center.sub}</p>
                    <p className="text-[11px] text-ocre-rouge/60 mt-0.5">{center.note}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${center.phone.replace(/\s+/g, "")}`}
                    className="press inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-vert-baobab/15 border border-vert-baobab/30 text-vert-baobab text-xs font-bold hover:bg-vert-baobab/25 transition-colors shadow-sm hover:shadow-md"
                  >
                    <Phone className="size-3.5" />
                    Appeler
                  </a>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(center.name + " " + center.city)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-terracotta/12 border border-terracotta/30 text-terracotta text-xs font-bold hover:bg-terracotta/22 transition-colors shadow-sm hover:shadow-md"
                  >
                    <Navigation className="size-3.5" />
                    Itinéraire
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === Calendrier de suivi — timeline verticale numérotée === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Calendrier de suivi
          </h3>
          <div className="sankofa-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="size-4 text-ocre-rouge" />
              <p className="text-xs font-semibold text-ocre-rouge">Tests VIH à programmer</p>
            </div>
            {/* Timeline verticale */}
            <div className="relative">
              {TIMELINE_STEPS.map((step, i) => {
                const isLast = i === TIMELINE_STEPS.length - 1;
                return (
                  <div key={step.period} className="relative flex items-start gap-3 pb-4 last:pb-0">
                    {/* Ligne de connexion verticale */}
                    {!isLast && (
                      <div
                        className="absolute left-[18px] top-9 bottom-0 w-0.5"
                        style={{ backgroundColor: `${step.color}40` }}
                        aria-hidden="true"
                      />
                    )}
                    {/* Cercle numéroté */}
                    <div
                      className="relative shrink-0 size-9 rounded-full flex items-center justify-center text-creme-baobab font-bold text-xs shadow-sm border-2 border-creme-baobab z-10"
                      style={{ backgroundColor: step.color }}
                    >
                      {step.number}
                    </div>
                    {/* Contenu */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: `${step.color}18`, color: step.color }}
                        >
                          {step.period}
                        </span>
                        <p className="text-sm font-semibold text-terre-brulee">{step.title}</p>
                      </div>
                      <p className="text-[11px] text-ocre-rouge/70 leading-snug mt-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* === CTA plan d'action — bien visible en bas === */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onActivatePlan}
            className="press w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-terracotta text-creme-baobab font-bold text-sm shadow-lg hover:bg-ocre-rouge transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-creme-baobab"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            <Zap className="size-4" />
            Active ton plan d'action — 1 500 F
            <FileText className="size-4 opacity-80" />
          </button>
          <p className="text-center text-[11px] text-ocre-rouge/70 mt-2">
            Wave · Orange Money · MTN Money
          </p>
        </div>
      </div>
    </div>
  );
}

export default TpeSection;
