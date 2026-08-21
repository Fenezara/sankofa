"use client";

/**
 * Sankofa — Section Témoignages Anonymes Modérés
 *
 * Innovation "Pair-Aidant Lite" — renforce le message "Tu n'es pas seul·e".
 *
 * - Header "Tu n'es pas seul·e" avec icône 🤍
 * - Filter chips par domaine (SSR, Addictologie, Dermatologie, Santé mentale, Nutrition)
 * - Cards de témoignages (title, content tronqué 200 chars + "Lire la suite",
 *   badge domaine, age range, hearts, bouton 🤍)
 * - Bouton "Partager ton histoire" → modal avec formulaire
 * - Message post-submit : "Merci d'avoir partagé. Ton témoignage sera visible
 *   après modération (24-48h). 🤍"
 * - Bouton "Voir plus" (pagination offset, 20 par page)
 * - Hydration-safe (state init statique, fetch en useEffect)
 *
 * Palette Sankofa :
 *   - rose-couchee (#B5684A) pour les cœurs
 *   - vert-baobab pour les badges approuvés
 *   - ambre-couchant pour les états en attente
 */

import * as React from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  Heart,
  Plus,
  Loader2,
  ChevronDown,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// === Domaines ===
type Domain = "SSR" | "Addictologie" | "Dermatologie" | "Santé mentale" | "Nutrition";

const DOMAINS: { id: Domain; label: string; color: string }[] = [
  { id: "SSR", label: "SSR", color: "#D65430" },
  { id: "Addictologie", label: "Addictologie", color: "#B84421" },
  { id: "Dermatologie", label: "Dermatologie", color: "#F5A623" },
  { id: "Santé mentale", label: "Santé mentale", color: "#5C3543" },
  { id: "Nutrition", label: "Nutrition", color: "#2D4A2D" },
];

// === Types API ===
interface Testimony {
  id: string;
  domain: string;
  title: string;
  content: string;
  ageRange: string | null;
  hearts: number;
  createdAt: string;
}

interface TestimonyListResponse {
  testimonies: Testimony[];
  total: number;
  hasMore: boolean;
}

// === Helpers ===

const ANONYMOUS_ID_KEY = "aya:anonymousId";

function getAnonymousId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!id) {
      id = uuidv4();
      window.localStorage.setItem(ANONYMOUS_ID_KEY, id);
    }
    return id;
  } catch {
    return uuidv4();
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function domainColor(domain: string): string {
  const d = DOMAINS.find((x) => x.id === domain);
  return d?.color ?? "#7A2E12";
}

function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    const diffD = Math.floor(diffH / 24);
    if (diffH < 1) return "à l'instant";
    if (diffH < 24) return `il y a ${diffH}h`;
    if (diffD === 1) return "hier";
    if (diffD < 7) return `il y a ${diffD}j`;
    if (diffD < 30) return `il y a ${Math.floor(diffD / 7)} sem.`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// === Composant principal ===

export function TestimoniesSection() {
  const [mounted, setMounted] = React.useState(false);
  const [activeDomain, setActiveDomain] = React.useState<Domain | "all">("all");
  const [testimonies, setTestimonies] = React.useState<Testimony[]>([]);
  const [total, setTotal] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [hearted, setHearted] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Hydration safety : on ne fetch que côté client
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Pré-charge les cœurs depuis localStorage (par anonymousId)
  React.useEffect(() => {
    if (!mounted) return;
    try {
      const raw = window.localStorage.getItem("sankofa:testimonies:hearted");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setHearted(new Set(arr));
      }
    } catch {}
  }, [mounted]);

  const persistHearted = React.useCallback((next: Set<string>) => {
    setHearted(next);
    try {
      window.localStorage.setItem(
        "sankofa:testimonies:hearted",
        JSON.stringify(Array.from(next)),
      );
    } catch {}
  }, []);

  // Fetch initial + filtres
  React.useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    setLoading(true);
    const qs =
      activeDomain === "all"
        ? "?limit=20&offset=0"
        : `?domain=${encodeURIComponent(activeDomain)}&limit=20&offset=0`;
    fetch(`/api/testimonies${qs}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TestimonyListResponse | null) => {
        if (cancelled || !data) return;
        setTestimonies(data.testimonies);
        setTotal(data.total);
        setHasMore(data.hasMore);
      })
      .catch(() => {
        if (!cancelled) {
          // Silencieux — pas de toast d'erreur au load initial
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDomain, mounted]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = testimonies.length;
      const qs =
        activeDomain === "all"
          ? `?limit=20&offset=${offset}`
          : `?domain=${encodeURIComponent(activeDomain)}&limit=20&offset=${offset}`;
      const res = await fetch(`/api/testimonies${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: TestimonyListResponse = await res.json();
      // Dédoublonne (au cas où)
      setTestimonies((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        const merged = [...prev, ...data.testimonies.filter((t) => !ids.has(t.id))];
        return merged;
      });
      setHasMore(data.hasMore);
    } catch {
      toast.error("Impossible de charger plus de témoignages.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleHeart = async (testimonyId: string) => {
    const anonymousId = getAnonymousId();
    const wasHearted = hearted.has(testimonyId);
    // Optimistic UI
    const nextSet = new Set(hearted);
    if (wasHearted) nextSet.delete(testimonyId);
    else nextSet.add(testimonyId);
    persistHearted(nextSet);

    setTestimonies((prev) =>
      prev.map((t) =>
        t.id === testimonyId
          ? { ...t, hearts: Math.max(0, t.hearts + (wasHearted ? -1 : 1)) }
          : t,
      ),
    );

    try {
      const res = await fetch(`/api/testimonies/${testimonyId}/heart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousId }),
      });
      if (!res.ok) {
        // Rollback
        const rollback = new Set(hearted);
        if (wasHearted) rollback.add(testimonyId);
        else rollback.delete(testimonyId);
        persistHearted(rollback);
        setTestimonies((prev) =>
          prev.map((t) =>
            t.id === testimonyId
              ? { ...t, hearts: Math.max(0, t.hearts + (wasHearted ? 1 : -1)) }
              : t,
          ),
        );
        toast.error("Action impossible pour le moment.");
        return;
      }
      const data = (await res.json()) as { hearted: boolean; hearts: number };
      // Sync finale avec la valeur serveur
      const finalSet = new Set(hearted);
      if (data.hearted) finalSet.add(testimonyId);
      else finalSet.delete(testimonyId);
      persistHearted(finalSet);
      setTestimonies((prev) =>
        prev.map((t) => (t.id === testimonyId ? { ...t, hearts: data.hearts } : t)),
      );
    } catch {
      // Rollback réseau
      const rollback = new Set(hearted);
      if (wasHearted) rollback.add(testimonyId);
      else rollback.delete(testimonyId);
      persistHearted(rollback);
      setTestimonies((prev) =>
        prev.map((t) =>
          t.id === testimonyId
            ? { ...t, hearts: Math.max(0, t.hearts + (wasHearted ? 1 : -1)) }
            : t,
        ),
      );
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section aria-labelledby="testimonies-heading" className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(181, 104, 74, 0.12)" }}
            aria-hidden="true"
          >
            <Heart className="size-4 text-rose-couchee fill-rose-couchee" />
          </span>
          <div>
            <h3
              id="testimonies-heading"
              className="text-sm font-bold text-terre-brulee leading-tight"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Tu n'es pas seul·e
            </h3>
            <p className="text-[11px] text-ocre-rouge/60 leading-tight">
              {total > 0 ? `${total} témoignages partagés` : "Témoignages anonymes"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShareOpen(true)}
          className="border-rose-couchee/40 text-rose-couchee hover:bg-rose-couchee/8 hover:text-rose-couchee"
          aria-label="Partager ton histoire"
        >
          <Plus className="size-3.5" />
          Partager
        </Button>
      </div>

      {/* Filter chips */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        role="tablist"
        aria-label="Filtrer par domaine"
        style={{ scrollbarWidth: "thin" }}
      >
        <DomainChip
          active={activeDomain === "all"}
          onClick={() => setActiveDomain("all")}
          label="Tous"
          color="#7A2E12"
        />
        {DOMAINS.map((d) => (
          <DomainChip
            key={d.id}
            active={activeDomain === d.id}
            onClick={() => setActiveDomain(d.id)}
            label={d.label}
            color={d.color}
          />
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-ocre-rouge/60">
          <Loader2 className="size-5 animate-spin text-rose-couchee" />
          <span className="text-xs">Chargement des témoignages…</span>
        </div>
      ) : !mounted ? (
        // SSR placeholder pour éviter mismatch hydration
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-ocre-rouge/40">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-xs">Chargement…</span>
        </div>
      ) : testimonies.length === 0 ? (
        <Card className="bg-creme-baobab/60 border-ocre-rouge/15 py-6 px-4">
          <div className="flex flex-col items-center text-center gap-2">
            <Heart className="size-6 text-rose-couchee/50" />
            <p className="text-sm font-semibold text-terre-brulee">
              Aucun témoignage {activeDomain !== "all" ? "dans ce domaine" : "encore"}.
            </p>
            <p className="text-xs text-ocre-rouge/60 max-w-xs">
              Sois le premier à partager ton expérience. Ton anonymat est protégé.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 border-rose-couchee/40 text-rose-couchee hover:bg-rose-couchee/8"
              onClick={() => setShareOpen(true)}
            >
              <Plus className="size-3.5" />
              Partager ton histoire
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {testimonies.map((t) => {
            const color = domainColor(t.domain);
            const isExpanded = expanded.has(t.id);
            const isHearted = hearted.has(t.id);
            const needsTruncation = t.content.length > 200;
            const displayContent =
              isExpanded || !needsTruncation ? t.content : truncate(t.content, 200);
            return (
              <Card
                key={t.id}
                className="bg-creme-baobab border-ocre-rouge/12 py-0 gap-0 shadow-sm overflow-hidden"
              >
                {/* Top stripe colored by domain */}
                <div className="h-0.5 w-full" style={{ backgroundColor: color }} />
                <div className="p-4 space-y-2.5">
                  {/* Title + badges */}
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className="text-sm font-bold text-terre-brulee leading-tight flex-1"
                      style={{ fontFamily: "var(--font-bricolage)" }}
                    >
                      {t.title}
                    </h4>
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5"
                      style={{
                        backgroundColor: `${color}1A`,
                        color: color,
                        borderColor: `${color}40`,
                      }}
                    >
                      {t.domain}
                    </Badge>
                  </div>

                  {/* Content */}
                  <p className="text-[13px] text-terre-brulee/85 leading-relaxed whitespace-pre-wrap">
                    {displayContent}
                  </p>
                  {needsTruncation && (
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="text-[11px] font-semibold text-rose-couchee hover:text-ocre-rouge transition-colors inline-flex items-center gap-0.5"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Réduire le témoignage" : "Lire la suite"}
                    >
                      {isExpanded ? "Réduire" : "Lire la suite"}
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </button>
                  )}

                  {/* Meta footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-ocre-rouge/8">
                    <div className="flex items-center gap-2 text-[10.5px] text-ocre-rouge/55">
                      {t.ageRange && (
                        <span className="px-1.5 py-0.5 rounded bg-ambre-couchant/10 text-ambre-couchant font-semibold">
                          {t.ageRange} ans
                        </span>
                      )}
                      <span aria-label={`Publié ${formatRelativeTime(t.createdAt)}`}>
                        {formatRelativeTime(t.createdAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleHeart(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all",
                        isHearted
                          ? "bg-rose-couchee/15 text-rose-couchee hover:bg-rose-couchee/20"
                          : "bg-ocre-rouge/5 text-ocre-rouge/70 hover:bg-ocre-rouge/10",
                      )}
                      aria-pressed={isHearted}
                      aria-label={isHearted ? "Retirer mon cœur" : "Donner un cœur"}
                    >
                      <Heart
                        className={cn(
                          "size-3.5 transition-all",
                          isHearted && "fill-rose-couchee text-rose-couchee",
                        )}
                      />
                      <span>{t.hearts}</span>
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Voir plus */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="text-ocre-rouge hover:bg-ocre-rouge/8"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Chargement…
                  </>
                ) : (
                  <>
                    Voir plus
                    <ChevronDown className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Privacy notice */}
      <p className="text-[10.5px] text-ocre-rouge/50 leading-snug flex items-start gap-1.5 px-1">
        <ShieldCheck className="size-3 shrink-0 mt-px text-vert-baobab/70" aria-hidden="true" />
        <span>
          100% anonyme. Témoignages relus sous 24-48h (pas de haine, pas de PII, pas de conseils
          médicaux). Ton anonymousId est local — jamais ton nom.
        </span>
      </p>

      {/* Modal partage */}
      <ShareTestimonyDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        submitting={submitting}
        onSubmit={async (data) => {
          setSubmitting(true);
          try {
            const anonymousId = getAnonymousId();
            const res = await fetch("/api/testimonies", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...data, anonymousId }),
            });
            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as { error?: string };
              toast.error(err.error ?? "Échec de l'envoi. Réessaie dans un moment.");
              return;
            }
            toast.success(
              "Merci d'avoir partagé. Ton témoignage sera visible après modération (24-48h). 🤍",
              { duration: 6000 },
            );
            setShareOpen(false);
          } catch {
            toast.error("Problème réseau. Réessaie.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </section>
  );
}

// === Sub-components ===

function DomainChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
        active
          ? "text-creme-baobab shadow-sm"
          : "bg-creme-baobab text-ocre-rouge/70 border-ocre-rouge/15 hover:bg-ocre-rouge/5",
      )}
      style={
        active
          ? { backgroundColor: color, borderColor: color }
          : undefined
      }
    >
      {label}
    </button>
  );
}

function ShareTestimonyDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: {
    domain: Domain;
    title: string;
    content: string;
    ageRange: string | null;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [domain, setDomain] = React.useState<Domain | "">("");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [ageRange, setAgeRange] = React.useState<string | "">("");

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      // Petit délai pour éviter le flicker visuel à la fermeture
      const t = setTimeout(() => {
        setDomain("");
        setTitle("");
        setContent("");
        setAgeRange("");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const titleTooLong = title.length > 100;
  const contentTooLong = content.length > 1000;
  const canSubmit =
    domain !== "" &&
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    !titleTooLong &&
    !contentTooLong &&
    !submitting;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void onSubmit({
      domain,
      title: title.trim(),
      content: content.trim(),
      ageRange: ageRange || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-creme-baobab max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-terre-brulee flex items-center gap-2"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            <Heart className="size-4 text-rose-couchee fill-rose-couchee" />
            Partage ton expérience
          </DialogTitle>
          <DialogDescription className="text-ocre-rouge/70 text-xs">
            Anonyme, modéré sous 24-48h. Ton anonymousId reste local — jamais ton nom.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Domaine */}
          <div className="space-y-1.5">
            <Label htmlFor="testimony-domain" className="text-xs text-terre-brulee">
              Domaine <span className="text-rose-couchee">*</span>
            </Label>
            <Select
              value={domain}
              onValueChange={(v) => setDomain(v as Domain)}
              required
            >
              <SelectTrigger id="testimony-domain" className="w-full bg-white/60">
                <SelectValue placeholder="Choisis un domaine" />
              </SelectTrigger>
              <SelectContent>
                {DOMAINS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Titre */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="testimony-title" className="text-xs text-terre-brulee">
                Titre <span className="text-rose-couchee">*</span>
              </Label>
              <span
                className={cn(
                  "text-[10px]",
                  titleTooLong ? "text-terracotta font-bold" : "text-ocre-rouge/50",
                )}
              >
                {title.length}/100
              </span>
            </div>
            <Input
              id="testimony-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ex : Mon premier dépistage, j'avais peur…"
              className="bg-white/60"
            />
          </div>

          {/* Contenu */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="testimony-content" className="text-xs text-terre-brulee">
                Ton histoire <span className="text-rose-couchee">*</span>
              </Label>
              <span
                className={cn(
                  "text-[10px]",
                  contentTooLong ? "text-terracotta font-bold" : "text-ocre-rouge/50",
                )}
              >
                {content.length}/1000
              </span>
            </div>
            <Textarea
              id="testimony-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1100}
              rows={5}
              placeholder="Ce que tu as vécu, ce qui t'a aidé·e, ce que tu veux dire aux autres jeunes qui passent par là…"
              className="bg-white/60 resize-none"
            />
            <p className="text-[10.5px] text-ocre-rouge/55 leading-snug">
              Pas de conseils médicaux, pas de PII (nom, téléphone, adresse), pas de haine.
              Reste dans ton vécu — ton expérience aide déjà.
            </p>
          </div>

          {/* Âge (optionnel) */}
          <div className="space-y-1.5">
            <Label htmlFor="testimony-age" className="text-xs text-terre-brulee">
              Tranche d'âge <span className="text-ocre-rouge/40">(optionnel)</span>
            </Label>
            <Select
              value={ageRange}
              onValueChange={(v) => setAgeRange(v === "none" ? "" : v)}
            >
              <SelectTrigger id="testimony-age" className="w-full bg-white/60">
                <SelectValue placeholder="Préfère ne pas dire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Préfère ne pas dire</SelectItem>
                <SelectItem value="15-17">15-17 ans</SelectItem>
                <SelectItem value="18-19">18-19 ans</SelectItem>
                <SelectItem value="20-24">20-24 ans</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-ocre-rouge/70 hover:bg-ocre-rouge/8"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-rose-couchee text-creme-baobab hover:bg-ocre-rouge"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  Partager <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TestimoniesSection;
