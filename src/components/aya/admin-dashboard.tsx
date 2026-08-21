"use client";

/**
 * Sankofa — Admin Dashboard (modal, secret keyword)
 *
 * Modal full-screen dark (terre-brulee), accessible en tapant la séquence
 * "aya-admin" sur le clavier (case-insensitive). Esc pour fermer.
 *
 * 4 sections :
 *   1. Stats globales (conversations, messages, red flags, TPE, payments, companion)
 *   2. 20 dernières conversations (anonymisées)
 *   3. Log des 10 derniers red flags
 *   4. Log des 10 derniers paiements
 *   5. Log des 5 dernières activations du mode compagnon
 *
 * ⚠️ MVP : les routes /api/admin/* ne sont PAS authentifiées. En production,
 *    il faut NextAuth + rôle admin + rate-limit. Voir note dans les routes.
 *
 * Hydration safety :
 *   - Le composant est 'use client' et render null tant que closed
 *   - Le listener clavier est monté en useEffect (post-mount)
 *   - Les fetchs ne se déclenchent qu'à l'ouverture du modal
 *   - Aucun Date.now() ou Math.random() au render initial
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  RefreshCw,
  ShieldAlert,
  Users,
  MessageSquare,
  AlertTriangle,
  Clock,
  CreditCard,
  Activity,
  Lock,
  TrendingUp,
  HeartPulse,
} from "lucide-react";
import { SankofaLogo } from "@/components/aya/sankofa-logo";
import { Badge } from "@/components/ui/badge";

const SECRET_SEQUENCE = "aya-admin";

interface AdminStats {
  generatedAt: string;
  totals: {
    conversations: number;
    messages: number;
    redFlagsTriggered: number;
    tpeActivations: number;
    paymentsInitiated: number;
    activeCompanionModes: number;
  };
  payments: {
    plan_action: { pending: number; success: number; failed: number; totalAmount: number };
    teleconsultation: { pending: number; success: number; failed: number; totalAmount: number };
    total: number;
  };
  triageBreakdown: Record<string, number>;
  companionNote: string;
}

interface AdminConversations {
  generatedAt: string;
  conversations: Array<{
    anonymousIdHash: string;
    messageCount: number;
    lastMessagePreview: string;
    triageLevel: string;
    updatedAt: string;
    createdAt: string;
  }>;
  redFlagLog: Array<{
    topic: string;
    timestamp: string;
    anonymousIdHash: string;
    preview: string;
  }>;
  paymentLog: Array<{
    tier: string;
    amount: number;
    status: string;
    timestamp: string;
    anonymousIdHash: string;
  }>;
  companionLog: Array<{
    trigger: string;
    startedAt: string;
    anonymousIdHash: string;
    stage: string;
  }>;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `il y a ${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `il y a ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    const d = Math.floor(h / 24);
    return `il y a ${d}j`;
  } catch {
    return iso;
  }
}

const TRIAGE_STYLES: Record<string, string> = {
  urgence: "bg-red-900/40 text-red-200 border-red-700/50",
  orientation: "bg-ambre-couchant/20 text-or-poudre-clair border-ambre-couchant/40",
  info: "bg-vert-baobab/20 text-emerald-200 border-vert-baobab/40",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-ambre-couchant/20 text-or-poudre-clair border-ambre-couchant/40",
  success: "bg-vert-baobab/20 text-emerald-200 border-vert-baobab/40",
  failed: "bg-red-900/40 text-red-200 border-red-700/50",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sublabel?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accent + "33", color: accent }}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-xs uppercase tracking-wider text-text-on-dark-muted">
          {label}
        </span>
      </div>
      <div
        className="text-3xl font-black text-text-on-dark"
        style={{ fontFamily: "var(--font-bricolage)" }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-xs text-text-on-dark-muted mt-1">{sublabel}</div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const [open, setOpen] = React.useState(false);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [convs, setConvs] = React.useState<AdminConversations | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // ---- Keyboard sequence listener ----
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let buffer = "";

    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      // Esc ferme le modal
      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }
      // Ignore si l'utilisateur tape dans un champ
      if (isTypingTarget(e.target)) return;
      // Ignore les modificateurs seuls
      if (e.key.length !== 1) return;

      buffer = (buffer + e.key.toLowerCase()).slice(-SECRET_SEQUENCE.length);
      if (buffer === SECRET_SEQUENCE) {
        buffer = "";
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ---- Fetch data when opened ----
  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, convsRes] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/conversations", { cache: "no-store" }),
      ]);
      if (!statsRes.ok || !convsRes.ok) {
        throw new Error("Erreur lors du chargement des données admin.");
      }
      const [s, c] = await Promise.all([statsRes.json(), convsRes.json()]);
      setStats(s as AdminStats);
      setConvs(c as AdminConversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open && !stats && !loading) {
      void fetchAll();
    }
  }, [open, stats, loading, fetchAll]);

  // ---- Render ----
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Tableau de bord administrateur Sankofa"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-noir-encre/90 backdrop-blur-md p-3 sm:p-6"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(155, 63, 31, 0.18) 0%, transparent 50%), radial-gradient(ellipse at bottom, rgba(43, 24, 16, 0.5) 0%, transparent 60%)",
            }}
            aria-hidden="true"
          />

          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-6xl my-4 sm:my-8 rounded-2xl border border-or-poudre-clair/25 bg-terre-brulee shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-or-poudre-clair/15 bg-terre-brulee/95 backdrop-blur">
              <div className="flex items-center gap-3 min-w-0">
                <SankofaLogo size={32} />
                <div className="min-w-0">
                  <h2
                    className="text-lg sm:text-xl font-bold text-text-on-dark truncate"
                    style={{ fontFamily: "var(--font-bricolage)" }}
                  >
                    Admin Dashboard
                  </h2>
                  <p className="text-xs text-text-on-dark-muted truncate">
                    Sankofa — analytics & moderation ·{" "}
                    {stats && (
                      <span>mis à jour {timeAgo(stats.generatedAt)}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void fetchAll()}
                  disabled={loading}
                  aria-label="Rafraîchir les données"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-on-dark-soft hover:text-text-on-dark hover:bg-or-poudre-clair/10 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">Rafraîchir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le tableau de bord admin"
                  className="inline-flex items-center justify-center size-8 rounded-lg text-text-on-dark-soft hover:text-text-on-dark hover:bg-or-poudre-clair/10 transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* MVP warning */}
            <div className="px-4 sm:px-6 py-2.5 bg-ambre-couchant/10 border-b border-ambre-couchant/20 flex items-start gap-2">
              <Lock className="size-4 text-or-poudre-clair shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-text-on-dark-soft leading-snug">
                <strong className="text-or-poudre-clair">MVP sans authentification.</strong>{" "}
                En production : protéger par NextAuth + rôle admin + rate-limit + logs d'audit.
                Toutes les données sont anonymisées (SHA-256 + sel).
              </p>
            </div>

            {/* Body */}
            <div className="px-4 sm:px-6 py-5 space-y-6 max-h-[calc(100vh-180px)] overflow-y-auto aya-admin-scroll">
              {error && (
                <div className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
                  <ShieldAlert className="size-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* === SECTION 1: Stats === */}
              <section aria-labelledby="admin-stats-title">
                <h3
                  id="admin-stats-title"
                  className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-on-dark-muted mb-3"
                >
                  <TrendingUp className="size-4" aria-hidden="true" />
                  Vue d'ensemble
                </h3>
                {stats ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <StatCard
                        icon={Users}
                        label="Conversations"
                        value={stats.totals.conversations}
                        accent="#F4C77B"
                      />
                      <StatCard
                        icon={MessageSquare}
                        label="Messages"
                        value={stats.totals.messages}
                        accent="#E89B3C"
                      />
                      <StatCard
                        icon={AlertTriangle}
                        label="Red flags"
                        value={stats.totals.redFlagsTriggered}
                        sublabel="proxy: triage=urgence"
                        accent="#C75B3C"
                      />
                      <StatCard
                        icon={Clock}
                        label="TPE 72h"
                        value={stats.totals.tpeActivations}
                        accent="#9B3F1F"
                      />
                      <StatCard
                        icon={CreditCard}
                        label="Paiements"
                        value={stats.totals.paymentsInitiated}
                        sublabel={`${stats.payments.total} tx`}
                        accent="#7B4B5C"
                      />
                      <StatCard
                        icon={HeartPulse}
                        label="Compagnon actif"
                        value={stats.totals.activeCompanionModes}
                        sublabel="< 1h (proxy)"
                        accent="#3D5C3D"
                      />
                    </div>

                    {/* Triage breakdown + payments detail */}
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 p-4">
                        <h4 className="text-xs uppercase tracking-wider text-text-on-dark-muted mb-3 flex items-center gap-1.5">
                          <Activity className="size-3.5" aria-hidden="true" />
                          Répartition triage (assistant)
                        </h4>
                        <div className="space-y-2">
                          {(["info", "orientation", "urgence"] as const).map((lvl) => {
                            const count = stats.triageBreakdown[lvl] ?? 0;
                            const total =
                              (stats.triageBreakdown.info ?? 0) +
                              (stats.triageBreakdown.orientation ?? 0) +
                              (stats.triageBreakdown.urgence ?? 0);
                            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            return (
                              <div key={lvl} className="flex items-center gap-2">
                                <span className="text-xs text-text-on-dark-soft w-20 capitalize">
                                  {lvl}
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-noir-encre/60 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor:
                                        lvl === "urgence"
                                          ? "#C75B3C"
                                          : lvl === "orientation"
                                            ? "#E89B3C"
                                            : "#3D5C3D",
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-text-on-dark-muted w-16 text-right tabular-nums">
                                  {count} · {pct}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 p-4">
                        <h4 className="text-xs uppercase tracking-wider text-text-on-dark-muted mb-3 flex items-center gap-1.5">
                          <CreditCard className="size-3.5" aria-hidden="true" />
                          Paiements (Mobile Money)
                        </h4>
                        <div className="space-y-2 text-xs">
                          {(["plan_action", "teleconsultation"] as const).map((tier) => {
                            const p = stats.payments[tier];
                            const label =
                              tier === "plan_action" ? "Plan d'action (1500)" : "Téléconsult. (3000)";
                            return (
                              <div
                                key={tier}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-text-on-dark-soft">{label}</span>
                                <span className="text-text-on-dark-muted tabular-nums">
                                  {p.success}✓ · {p.pending}⏳ · {p.failed}✗
                                </span>
                                <span className="text-or-poudre-clair font-semibold tabular-nums w-20 text-right">
                                  {p.totalAmount.toLocaleString("fr-FR")} F
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-or-poudre-clair/10 bg-noir-encre/30 p-4 h-24 animate-pulse"
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* === SECTION 2: Recent conversations === */}
              <section aria-labelledby="admin-conv-title">
                <h3
                  id="admin-conv-title"
                  className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-on-dark-muted mb-3"
                >
                  <Users className="size-4" aria-hidden="true" />
                  20 dernières conversations
                </h3>
                <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 overflow-hidden">
                  <div className="max-h-72 overflow-y-auto aya-admin-scroll">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-terre-brulee text-text-on-dark-muted">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">ID anonyme</th>
                          <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">
                            Dernier message
                          </th>
                          <th className="text-center font-medium px-3 py-2">Msgs</th>
                          <th className="text-left font-medium px-3 py-2">Triage</th>
                          <th className="text-right font-medium px-3 py-2">MAJ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {convs ? (
                          convs.conversations.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-3 py-6 text-center text-text-on-dark-muted"
                              >
                                Aucune conversation pour le moment.
                              </td>
                            </tr>
                          ) : (
                            convs.conversations.map((c) => (
                              <tr
                                key={c.anonymousIdHash}
                                className="border-t border-or-poudre-clair/8 hover:bg-or-poudre-clair/5"
                              >
                                <td className="px-3 py-2 font-mono text-text-on-dark-soft">
                                  {c.anonymousIdHash}
                                </td>
                                <td className="px-3 py-2 text-text-on-dark-muted hidden sm:table-cell max-w-xs truncate">
                                  {c.lastMessagePreview}
                                </td>
                                <td className="px-3 py-2 text-center text-text-on-dark tabular-nums">
                                  {c.messageCount}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      TRIAGE_STYLES[c.triageLevel] ?? TRIAGE_STYLES.info
                                    }`}
                                  >
                                    {c.triageLevel}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right text-text-on-dark-muted whitespace-nowrap">
                                  {timeAgo(c.updatedAt)}
                                </td>
                              </tr>
                            ))
                          )
                        ) : (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i} className="border-t border-or-poudre-clair/8">
                              <td colSpan={5} className="px-3 py-3">
                                <div className="h-3 bg-or-poudre-clair/10 rounded animate-pulse" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* === SECTION 3 & 4 & 5: Logs === */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Red flag log */}
                <section aria-labelledby="admin-redflags-title">
                  <h3
                    id="admin-redflags-title"
                    className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-on-dark-muted mb-3"
                  >
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    Red flags (10 derniers)
                  </h3>
                  <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 p-3 max-h-72 overflow-y-auto aya-admin-scroll space-y-2">
                    {convs ? (
                      convs.redFlagLog.length === 0 ? (
                        <p className="text-xs text-text-on-dark-muted text-center py-4">
                          Aucun red flag pour le moment.
                        </p>
                      ) : (
                        convs.redFlagLog.map((r, i) => (
                          <div
                            key={`${r.timestamp}-${i}`}
                            className="rounded-lg border border-red-700/30 bg-red-900/15 p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className="text-[10px] border-red-700/50 bg-red-900/30 text-red-200"
                              >
                                {r.topic}
                              </Badge>
                              <span className="text-[10px] text-text-on-dark-muted whitespace-nowrap">
                                {formatTime(r.timestamp)}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-on-dark-soft line-clamp-2">
                              {r.preview}
                            </p>
                            <p className="text-[10px] font-mono text-text-on-dark-muted mt-1">
                              user: {r.anonymousIdHash}
                            </p>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 bg-or-poudre-clair/10 rounded animate-pulse"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Payment log */}
                <section aria-labelledby="admin-payments-title">
                  <h3
                    id="admin-payments-title"
                    className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-on-dark-muted mb-3"
                  >
                    <CreditCard className="size-4" aria-hidden="true" />
                    Paiements (10 derniers)
                  </h3>
                  <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 p-3 max-h-72 overflow-y-auto aya-admin-scroll space-y-2">
                    {convs ? (
                      convs.paymentLog.length === 0 ? (
                        <p className="text-xs text-text-on-dark-muted text-center py-4">
                          Aucun paiement pour le moment.
                        </p>
                      ) : (
                        convs.paymentLog.map((p, i) => (
                          <div
                            key={`${p.timestamp}-${i}`}
                            className="rounded-lg border border-or-poudre-clair/15 bg-noir-encre/40 p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-text-on-dark">
                                {p.tier === "plan_action" ? "Plan d'action" : "Téléconsult."}
                              </span>
                              <span className="text-xs font-bold text-or-poudre-clair tabular-nums">
                                {p.amount.toLocaleString("fr-FR")} F
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  PAYMENT_STATUS_STYLES[p.status] ??
                                  "bg-noir-encre/40 text-text-on-dark-muted border-or-poudre-clair/20"
                                }`}
                              >
                                {p.status}
                              </span>
                              <span className="text-[10px] text-text-on-dark-muted">
                                {formatTime(p.timestamp)}
                              </span>
                            </div>
                            <p className="text-[10px] font-mono text-text-on-dark-muted mt-1">
                              user: {p.anonymousIdHash}
                            </p>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 bg-or-poudre-clair/10 rounded animate-pulse"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Companion mode log */}
                <section aria-labelledby="admin-companion-title">
                  <h3
                    id="admin-companion-title"
                    className="flex items-center gap-2 text-sm uppercase tracking-wider text-text-on-dark-muted mb-3"
                  >
                    <HeartPulse className="size-4" aria-hidden="true" />
                    Mode compagnon (5 derniers)
                  </h3>
                  <div className="rounded-xl border border-or-poudre-clair/15 bg-noir-encre/40 p-3 max-h-72 overflow-y-auto aya-admin-scroll space-y-2">
                    {convs ? (
                      convs.companionLog.length === 0 ? (
                        <p className="text-xs text-text-on-dark-muted text-center py-4">
                          Aucune activation. Le mode compagnon est client-side.
                        </p>
                      ) : (
                        convs.companionLog.map((c, i) => (
                          <div
                            key={`${c.startedAt}-${i}`}
                            className="rounded-lg border border-or-poudre-clair/15 bg-noir-encre/40 p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  c.trigger === "tpe"
                                    ? "border-ocre-rouge/50 bg-ocre-rouge/20 text-or-poudre-clair"
                                    : "border-red-700/50 bg-red-900/30 text-red-200"
                                }`}
                              >
                                {c.trigger === "tpe" ? "TPE 72h" : "red flag"}
                              </Badge>
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                  c.stage === "active"
                                    ? "bg-vert-baobab/20 text-emerald-200 border-vert-baobab/40"
                                    : "bg-noir-encre/40 text-text-on-dark-muted border-or-poudre-clair/20"
                                }`}
                              >
                                {c.stage}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-on-dark-muted">
                              {formatTime(c.startedAt)}
                            </p>
                            <p className="text-[10px] font-mono text-text-on-dark-muted mt-1">
                              user: {c.anonymousIdHash}
                            </p>
                          </div>
                        ))
                      )
                    ) : (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 bg-or-poudre-clair/10 rounded animate-pulse"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-or-poudre-clair/15 bg-terre-brulee/80 flex items-center justify-between gap-2">
              <p className="text-[11px] text-text-on-dark-muted">
                Astuce : tape <kbd className="px-1.5 py-0.5 rounded bg-noir-encre/60 border border-or-poudre-clair/20 text-text-on-dark-soft font-mono">Esc</kbd> pour fermer.
              </p>
              <p className="text-[11px] text-text-on-dark-muted hidden sm:block">
                Données anonymisées · SHA-256 + sel
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AdminDashboard;
