"use client";

/**
 * Sankofa — Tab Carnet (V3 — perfectionné)
 *
 * - En-tête simple : "Carnet" / "Chiffré AES-256 · 100% local"
 * - Compteur d'entries en haut (si carnet ouvert)
 * - Card sécurité : icônes par ligne (Lock, Key, Clock, Shield)
 * - CTA principal "Ouvrir mon carnet"
 * - Grille 3 colonnes de 6 types d'entries (icônes Lucide par type)
 * - Card sync cloud :
 *     · si connecté·e → bouton "Sauvegarder maintenant"
 *     · si non connecté·e → "Connecte-toi pour synchroniser" + bouton
 */

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Lock,
  ShieldCheck,
  KeyRound,
  Clock,
  ArrowRight,
  Cloud,
  Download,
  Upload,
  AlertTriangle,
  Stethoscope,
  FlaskConical,
  Bell,
  StickyNote,
  History,
  LogIn,
  FileText,
} from "lucide-react";
import { useSession } from "@/components/auth/auth-provider";

// Cycle menstruel chiffré (Task 3-cycle) — section sous les types d'entries
import { CycleSection } from "@/components/aya/cycle-section";

// AuthModal — dynamic import (ssr: false) car navigateur-only
const AuthModal = dynamic(
  () => import("@/components/auth/auth-modal").then((m) => m.AuthModal),
  { ssr: false, loading: () => null },
);

interface CarnetSectionProps {
  onOpenCarnet: () => void;
}

const ENTRY_TYPES = [
  { label: "Consultations", icon: Stethoscope, color: "#D65430" }, // terracotta
  { label: "Tests", icon: FlaskConical, color: "#2D4A2D" }, // vert-baobab (wax forest green d'Aya)
  { label: "Rappels", icon: Bell, color: "#8B5A14" }, // ambre-couchant
  { label: "Notes", icon: StickyNote, color: "#5C3543" }, // mauve-crepuscule
  { label: "Allergies", icon: AlertTriangle, color: "#A8451F" }, // terracotta
  { label: "Antécédents", icon: History, color: "#7A2E12" }, // ocre-rouge
];

const SECURITY_ROWS = [
  { icon: Lock, label: "Chiffrement AES-256", value: "côté client" },
  { icon: KeyRound, label: "PIN", value: "6 chiffres · 5 essais max" },
  { icon: Clock, label: "Verrouillage auto", value: "5 min d'inactivité" },
  { icon: ShieldCheck, label: "Récupération", value: "aucune possible" },
];

export function CarnetSection({ onOpenCarnet }: CarnetSectionProps) {
  const { data: session, status } = useSession();
  // Évite le mismatch d'hydration : on ne rend la card cloud que côté client
  // une fois la session résolue.
  const [mounted, setMounted] = React.useState(false);
  const [authOpen, setAuthOpen] = React.useState(false);
  const [entryCount, setEntryCount] = React.useState(0);
  React.useEffect(() => setMounted(true), []);
  const isLoggedIn = mounted && status === "authenticated" && !!session?.user;

  // Écoute le compteur d'entries dispatché par le Carnet (modal)
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ count: number }>).detail;
      if (detail && typeof detail.count === "number") {
        setEntryCount(detail.count);
      }
    };
    window.addEventListener("sankofa:carnet-count", handler);
    return () => window.removeEventListener("sankofa:carnet-count", handler);
  }, []);

  return (
    <div className="flex flex-col">
      {/* En-tête simple */}
      <div className="px-4 py-3 border-b border-ocre-rouge/10 bg-creme-baobab shrink-0">
        <h1
          className="text-xl font-bold text-terre-brulee"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          Carnet
        </h1>
        <p className="text-xs text-ocre-rouge/60 mt-0.5">Chiffré AES-256 · 100% local</p>
      </div>

      {/* Zone de contenu scrollable */}
      <div className="flex-1 min-h-0 px-4 py-4 space-y-4">
        {/* === Compteur d'entries (si carnet ouvert / count > 0) === */}
        {mounted && entryCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-terracotta/10 border border-terracotta/25">
            <FileText className="size-4 text-terracotta shrink-0" />
            <p className="text-xs text-terre-brulee font-medium">
              <span className="font-bold">{entryCount}</span> entrée{entryCount > 1 ? "s" : ""} dans ton carnet
            </p>
          </div>
        )}

        {/* === Card sécurité — icônes par ligne === */}
        <div className="sankofa-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-9 rounded-lg bg-terracotta/15 flex items-center justify-center">
              <Lock className="size-4 text-terracotta" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-terre-brulee">Sécurité</h2>
              <p className="text-[11px] text-ocre-rouge/70">Tes données ne quittent jamais ton téléphone</p>
            </div>
          </div>
          <div className="space-y-2">
            {SECURITY_ROWS.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-ocre-rouge/5 transition-colors"
                >
                  <div className="shrink-0 size-7 rounded-md bg-ocre-rouge/10 flex items-center justify-center">
                    <Icon className="size-3.5 text-ocre-rouge" />
                  </div>
                  <span className="text-xs text-terre-brulee/80 flex-1">{row.label}</span>
                  <span className="text-xs font-semibold text-terre-brulee text-right">{row.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* === CTA principal === */}
        <button
          type="button"
          onClick={onOpenCarnet}
          className="press w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-terracotta text-creme-baobab font-bold text-sm shadow-lg hover:bg-ocre-rouge transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-creme-baobab"
          style={{ fontFamily: "var(--font-bricolage)" }}
        >
          <Lock className="size-4" />
          Ouvrir mon carnet
          <ArrowRight className="size-4 opacity-80" />
        </button>
        <p className="text-center text-[11px] text-ocre-rouge/70 -mt-2">
          1ère ouverture : choisis un PIN à 6 chiffres.
        </p>

        {/* === Types d'entries — icônes Lucide par type === */}
        <div>
          <h3 className="text-[11px] uppercase tracking-widest text-ocre-rouge/70 font-semibold mb-2 px-1">
            Types d'entries
          </h3>
          <div className="grid grid-cols-3 gap-2.5">
            {ENTRY_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.label}
                  onClick={onOpenCarnet}
                  className="press sankofa-card sankofa-card-pressable rounded-2xl p-3 flex flex-col items-center gap-1.5 aspect-square justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-creme-baobab"
                >
                  <div
                    className="size-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${t.color}1A` }}
                  >
                    <Icon className="size-4" style={{ color: t.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-terre-brulee text-center leading-tight">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* === Features compactes : export / import / wipe === */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Download, label: "Export .aya" },
            { icon: Upload, label: "Import .aya" },
            { icon: AlertTriangle, label: "Wipe 5 essais" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.label}
                className="sankofa-card rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center"
              >
                <Icon className="size-4 text-ocre-rouge" />
                <span className="text-[10px] font-semibold text-terre-brulee leading-tight">
                  {f.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* === Sync cloud === */}
        {mounted && isLoggedIn ? (
          // Connecté·e → bouton "Sauvegarder maintenant"
          <div className="bg-gradient-to-br from-or-poudre-clair/15 to-creme-baobab rounded-2xl border border-or-poudre-clair/40 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="shrink-0 size-9 rounded-lg bg-or-poudre-clair/25 flex items-center justify-center">
                <Cloud className="size-4 text-ambre-couchant" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-terre-brulee">Sync cloud</h3>
                <p className="text-[11px] text-ocre-rouge/80 mt-0.5 leading-snug">
                  Sauvegarde ton carnet chiffré. Toujours illisible sans ton PIN.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="press mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-or-poudre-clair/30 border border-or-poudre-clair/50 text-ambre-couchant text-xs font-bold hover:bg-or-poudre-clair/40 transition-colors"
            >
              <Cloud className="size-3.5" />
              Sauvegarder maintenant
            </button>
          </div>
        ) : (
          // Non connecté·e → "Connecte-toi pour synchroniser"
          <div className="bg-gradient-to-br from-ocre-rouge/8 to-creme-baobab rounded-2xl border border-ocre-rouge/20 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="shrink-0 size-9 rounded-lg bg-ocre-rouge/12 flex items-center justify-center">
                <Cloud className="size-4 text-ocre-rouge/70" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-terre-brulee">Sync cloud</h3>
                <p className="text-[11px] text-ocre-rouge/80 mt-0.5 leading-snug">
                  Connecte-toi pour synchroniser ton carnet sur tes appareils. Toujours chiffré.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="press mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-ocre-rouge/15 border border-ocre-rouge/30 text-ocre-rouge text-xs font-bold hover:bg-ocre-rouge/25 transition-colors"
            >
              <LogIn className="size-3.5" />
              Connecte-toi pour synchroniser
            </button>
            <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
          </div>
        )}

        {/* === Calendrier menstruel chiffré (Task 3-cycle) === */}
        <CycleSection />

        {/* Note privacy */}
        <p className="text-center text-[11px] text-ocre-rouge/70 italic px-4">
          « Ce que tu confies à Sankofa reste entre toi et Sankofa. »
        </p>
      </div>
    </div>
  );
}

export default CarnetSection;
