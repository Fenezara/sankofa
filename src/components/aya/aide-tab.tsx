"use client";

/**
 * Sankofa — Tab Aide (V3 — perfectionné)
 *
 * - En-tête simple : "Aide & Info" / "Conformité · Urgences · CGU"
 * - Urgences : grand numéro cliquable (tel:) + icône (Phone + Ambulance / Heart / Shield)
 * - Conformité : icônes CheckCircle2 (✅) et Clock (🔄)
 * - Tarifs : chaque tier a un bouton "Choisir" qui appelle onPay
 * - Documents : icône FileText + flèche →
 * - Version card : liens "Évaluer Sankofa" + "Contacter le support"
 */

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Phone,
  ShieldCheck,
  FileText,
  Presentation,
  CheckCircle2,
  Clock,
  ChevronRight,
  Heart,
  Ambulance,
  Shield,
  Star,
  Mail,
} from "lucide-react";

// Pitch deck — dynamic import (ssr:false)
const PitchDeck = dynamic(
  () => import("@/components/aya/pitch-deck").then((m) => m.PitchDeck),
  { ssr: false, loading: () => null },
);

interface AideTabProps {
  onOpenCgu: () => void;
  onPay: (tier: "plan_action" | "teleconsultation") => void;
}

const EMERGENCIES = [
  {
    number: "185",
    label: "SAMU",
    sub: "Urgence médicale vitale",
    color: "#A8451F",
    href: "tel:185",
    icon: Ambulance,
  },
  {
    number: "143",
    label: "Écoute psy",
    sub: "Détresse psychologique · 24h/24",
    color: "#8B5A14",
    href: "tel:143",
    icon: Heart,
  },
  {
    number: "110",
    label: "Police",
    sub: "Secours / agression",
    color: "#7A2E12",
    href: "tel:110",
    icon: Shield,
  },
];

const COMPLIANCE = [
  { label: "Décret 2018-361", sub: "Télémédecine CI", status: "ok" as const },
  { label: "ARTCI (loi 2013)", sub: "Protection données", status: "ok" as const },
  { label: "AIBEF partenaire", sub: "À signer", status: "pending" as const },
  { label: "CNOMCI", sub: "Ordre des Médecins CI", status: "ok" as const },
];

const PRICING_ROWS = [
  { price: "Gratuit", label: "Triage", sub: "Toujours, pour tou·te·s" },
  {
    price: "1 500 F",
    label: "Plan d'action",
    sub: "TPE 72h, IST, urgences",
    tier: "plan_action" as const,
  },
  {
    price: "3 000 F",
    label: "Téléconsultation",
    sub: "Médecin ivoirien · 24h",
    tier: "teleconsultation" as const,
  },
];

const DOCUMENTS = [
  { label: "CGU & Confidentialité", icon: FileText, action: "cgu" as const },
  { label: "Charte éthique", icon: ShieldCheck, action: "cgu" as const },
  { label: "Pitch deck", icon: Presentation, action: "pitch" as const },
];

export function AideTab({ onOpenCgu, onPay }: AideTabProps) {
  const [pitchOpen, setPitchOpen] = React.useState(false);

  const handleDocClick = (action: "cgu" | "pitch") => {
    if (action === "cgu") onOpenCgu();
    else setPitchOpen(true);
  };

  return (
    <div className="flex flex-col">
      {/* En-tête simple */}
      <div className="px-4 py-3 border-b border-ocre-rouge/10 bg-creme-baobab shrink-0">
        <h1
          className="text-xl font-bold text-terre-brulee"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Aide &amp; Info
        </h1>
        <p className="text-xs text-ocre-rouge/60 mt-0.5">Conformité · Urgences · CGU</p>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 min-h-0 px-4 py-4 space-y-4">
        {/* === Urgences — grand numéro cliquable + icône === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-terracotta animate-pulse" aria-hidden="true" />
            Urgences
          </h3>
          <div className="space-y-2.5">
            {EMERGENCIES.map((e) => {
              const Icon = e.icon;
              return (
                <a
                  key={e.number}
                  href={e.href}
                  className="press sankofa-card block rounded-2xl p-4 group"
                >
                  <div className="flex items-center gap-3">
                    {/* Icône contexte */}
                    <div
                      className="shrink-0 size-12 rounded-xl flex items-center justify-center text-creme-baobab shadow-sm"
                      style={{ backgroundColor: e.color }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-3xl font-black text-terre-brulee leading-none"
                          style={{ fontFamily: "var(--font-bricolage)" }}
                        >
                          {e.number}
                        </span>
                        <span className="text-sm font-bold text-ocre-rouge">{e.label}</span>
                      </div>
                      <p className="text-[11px] text-ocre-rouge/70 mt-1">{e.sub}</p>
                    </div>
                    {/* Bouton Phone */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <div
                        className="size-10 rounded-full flex items-center justify-center text-creme-baobab shadow-sm group-hover:scale-110 transition-transform"
                        style={{ backgroundColor: e.color }}
                      >
                        <Phone className="size-4" />
                      </div>
                      <span className="text-[9px] font-bold text-ocre-rouge/70 uppercase tracking-wider">
                        Appeler
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* === Conformité — icônes CheckCircle2 / Clock === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Conformité
          </h3>
          <div className="sankofa-card rounded-2xl p-4">
            <div className="space-y-3">
              {COMPLIANCE.map((c) => (
                <div key={c.label} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-terre-brulee">{c.label}</p>
                    <p className="text-[11px] text-ocre-rouge/70">{c.sub}</p>
                  </div>
                  {c.status === "ok" ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-vert-baobab/15 text-vert-baobab text-[11px] font-bold">
                      <CheckCircle2 className="size-3.5" /> Conforme
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-ambre-couchant/15 text-ambre-couchant text-[11px] font-bold">
                      <Clock className="size-3.5" /> En cours
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* === Tarifs — bouton "Choisir" sur chaque tier === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Tarifs
          </h3>
          <div className="sankofa-card rounded-2xl p-4">
            <div className="space-y-3">
              {PRICING_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center gap-3 ${
                    i !== PRICING_ROWS.length - 1 ? "pb-3 border-b border-ocre-rouge/10" : ""
                  }`}
                >
                  <div className="shrink-0 w-20">
                    <p
                      className="text-base font-black text-terracotta"
                      style={{ fontFamily: "var(--font-bricolage)" }}
                    >
                      {row.price}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-terre-brulee">{row.label}</p>
                    <p className="text-[11px] text-ocre-rouge/70">{row.sub}</p>
                  </div>
                  {row.tier ? (
                    <button
                      type="button"
                      onClick={() => onPay(row.tier!)}
                      className="press shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-full bg-terracotta text-creme-baobab text-[11px] font-bold hover:bg-ocre-rouge transition-colors shadow-sm hover:shadow-md"
                    >
                      Choisir
                    </button>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-full bg-vert-baobab/15 text-vert-baobab text-[11px] font-bold">
                      <CheckCircle2 className="size-3" /> Actif
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ocre-rouge/70 italic">
              Wave · Orange Money · MTN Money
            </p>
          </div>
        </div>

        {/* === Documents — icône FileText + flèche → === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Documents
          </h3>
          <div className="sankofa-card rounded-2xl overflow-hidden">
            {DOCUMENTS.map((doc, i) => {
              const Icon = doc.icon;
              return (
                <button
                  key={doc.label}
                  type="button"
                  onClick={() => handleDocClick(doc.action)}
                  className={`press w-full flex items-center gap-3 p-4 hover:bg-ocre-rouge/5 transition-colors text-left ${
                    i !== DOCUMENTS.length - 1 ? "border-b border-ocre-rouge/10" : ""
                  }`}
                >
                  <div className="shrink-0 size-9 rounded-lg bg-ocre-rouge/10 flex items-center justify-center">
                    <Icon className="size-4 text-ocre-rouge" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-terre-brulee">{doc.label}</span>
                  <ChevronRight className="size-4 text-ocre-rouge/40" />
                </button>
              );
            })}
          </div>
        </div>

        {/* === Version card — liens Évaluer + Contacter le support === */}
        <div className="sankofa-card rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Heart className="size-4 text-terracotta" />
            <p
              className="text-sm font-bold text-terre-brulee"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Sankofa v1.0.0
            </p>
          </div>
          <p className="text-[11px] text-ocre-rouge/80">Façonnée à Abidjan 🇨🇮</p>

          {/* Liens d'action */}
          <div className="mt-3 flex flex-col gap-1.5">
            <a
              href="mailto:contact@sankofa.ci?subject=Évaluation%20Sankofa"
              className="press inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-or-poudre-clair/15 border border-or-poudre-clair/30 text-ambre-couchant text-xs font-bold hover:bg-or-poudre-clair/25 transition-colors"
            >
              <Star className="size-3.5" />
              Évaluer Sankofa
            </a>
            <a
              href="mailto:contact@sankofa.ci"
              className="press inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-ocre-rouge/10 border border-ocre-rouge/20 text-ocre-rouge text-xs font-bold hover:bg-ocre-rouge/15 transition-colors"
            >
              <Mail className="size-3.5" />
              Contacter le support
            </a>
          </div>
        </div>

        {/* Disclaimer compact */}
        <p className="text-center text-[10px] text-ocre-rouge/60 italic px-2">
          Sankofa n'est pas un médecin. Assistant IA d'orientation, encadré par un comité médical
          et conforme au Décret 2018-361.
        </p>
      </div>

      {/* Pitch deck modal (dynamic, ssr:false) */}
      <PitchDeck open={pitchOpen} onOpenChange={setPitchOpen} />
    </div>
  );
}

export default AideTab;
