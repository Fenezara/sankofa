"use client";

/**
 * Sankofa — Calendrier Menstruel Chiffré (Task 3-cycle)
 *
 * Innovation : tracker de cycle menstruel 100% privacy-first.
 * - Données chiffrées AES-256-GCM côté client (Web Crypto API)
 * - Le serveur ne JAMAIS voir le contenu (blob chiffré seulement)
 * - Sync cloud optionnelle si authentifié·e (via /api/cycle/sync)
 * - Fallback localStorage si anonyme
 *
 * Fonctionnalités :
 * - Calendrier mensuel (grille HTML/CSS native, pas de lib externe)
 * - Marquage des jours de règles (point terracotta #B5684A)
 * - Fenêtre fertile prédite (fond ambre-couchant léger)
 * - Ovulation prédite (point vert-baobab)
 * - Multi-select symptômes (crampes, migraine, fatigue, sautes d'humeur,
 *   seins douloureux, ballonnements)
 * - Sélecteur de flux (léger/moyen/abondant)
 * - Prédictions : "Prochaines règles estimées : 12 mars (dans 5 jours)"
 * - Alerte retard > 5 jours → suggestion test de grossesse
 *
 * Couleurs (palette Sankofa) :
 * - Période : #B5684A (rose-couchée / terracotta)
 * - Fenêtre fertile : ambre-couchant (clair)
 * - Ovulation : vert-baobab
 * - Aujourd'hui : contour ocre-rouge
 *
 * Hydration-safe : toutes les Date / localStorage dans useEffect.
 */

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  AlertTriangle,
  Plus,
  Cloud,
  Trash2,
  Sparkles,
  Droplet,
  CloudOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/auth/auth-provider";

import {
  type CycleEntry,
  type CycleSymptom,
  type Flow,
  CYCLE_SYMPTOMS,
  SYMPTOM_LABELS,
  FLOW_LABELS,
  predictNextPeriod,
  predictFertileWindow,
  predictOvulation,
  isLate,
  averageCycleLength,
  averagePeriodLength,
  formatHumanDate,
  formatRelativeDays,
  formatDate,
  parseDate,
  addDays,
  diffDays,
  todayUTC,
  isDateInRange,
  getMonthGrid,
  getMonthLabel,
  WEEKDAY_LABELS,
  LATE_THRESHOLD_DAYS,
} from "@/lib/cycle";
import {
  bytesToBase64,
  base64ToBytes,
  serializeEncrypted,
  deserializeEncrypted,
} from "@/lib/carnet/crypto";

/* =========================================================
   PERSISTENCE — clé device + blob chiffré localStorage
   ========================================================= */

const KEY_MATERIAL_LS = "sankofa:cycle-key-material"; // base64 32 octets
const BLOB_LS = "sankofa:cycle-blob"; // JSON { iv, ciphertext, cycleCount, version, updatedAt }
const CURRENT_VERSION = 1;

/**
 * Récupère (ou crée) la CryptoKey AES-256-GCM du device.
 *
 * Le matériel de clé (32 octets aléatoires) est stocké en base64 dans localStorage
 * à la première utilisation, puis importé comme CryptoKey non-extractible.
 *
 * Privacy : la clé ne JAMAIS quitter le device. Le blob chiffré synchronisé
 * au cloud est inutilisable sans cette clé locale.
 */
async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  if (typeof window === "undefined" || !crypto?.subtle) {
    throw new Error("Web Crypto non disponible.");
  }
  let b64 = window.localStorage.getItem(KEY_MATERIAL_LS);
  if (!b64) {
    const material = new Uint8Array(32); // 256 bits
    crypto.getRandomValues(material);
    b64 = bytesToBase64(material);
    window.localStorage.setItem(KEY_MATERIAL_LS, b64);
  }
  const material = base64ToBytes(b64);
  return crypto.subtle.importKey(
    "raw",
    material as BufferSource,
    { name: "AES-GCM" },
    false, // non-extractible
    ["encrypt", "decrypt"],
  );
}

interface EncryptedBlob {
  iv: string;
  ciphertext: string;
  cycleCount: number;
  version: number;
  updatedAt: string;
}

async function encryptCycles(
  cycles: CycleEntry[],
  key: CryptoKey,
): Promise<EncryptedBlob> {
  const ivBytes = new Uint8Array(12);
  crypto.getRandomValues(ivBytes);
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify({ cycles }));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    key,
    plaintext,
  );
  const serialized = serializeEncrypted({
    iv: ivBytes,
    ciphertext,
  });
  return {
    iv: serialized.iv,
    ciphertext: serialized.ciphertext,
    cycleCount: cycles.length,
    version: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

async function decryptCycles(
  blob: EncryptedBlob,
  key: CryptoKey,
): Promise<CycleEntry[]> {
  const encrypted = deserializeEncrypted({
    iv: blob.iv,
    ciphertext: blob.ciphertext,
  });
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encrypted.iv as BufferSource },
    key,
    encrypted.ciphertext,
  );
  const dec = new TextDecoder();
  const parsed = JSON.parse(dec.decode(plaintext)) as { cycles?: CycleEntry[] };
  return Array.isArray(parsed.cycles) ? parsed.cycles : [];
}

function loadBlobFromLS(): EncryptedBlob | null {
  try {
    const raw = window.localStorage.getItem(BLOB_LS);
    if (!raw) return null;
    return JSON.parse(raw) as EncryptedBlob;
  } catch {
    return null;
  }
}

function saveBlobToLS(blob: EncryptedBlob): void {
  window.localStorage.setItem(BLOB_LS, JSON.stringify(blob));
}

/* =========================================================
   COMPOSANT
   ========================================================= */

const FLOW_OPTIONS: { value: Flow; color: string }[] = [
  { value: "light", color: "#F5C97A" }, // ambre clair
  { value: "medium", color: "#D65430" }, // terracotta
  { value: "heavy", color: "#A8451F" }, // terracotta foncé
];

export function CycleSection() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = React.useState(false);
  const [cycles, setCycles] = React.useState<CycleEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSyncAt, setLastSyncAt] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<Date | null>(null);
  const [viewYear, setViewYear] = React.useState<number>(0);
  const [viewMonth, setViewMonth] = React.useState<number>(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Formulaire "Marquer mes règles"
  const [formDate, setFormDate] = React.useState<string>("");
  const [formEndDate, setFormEndDate] = React.useState<string>("");
  const [formSymptoms, setFormSymptoms] = React.useState<CycleSymptom[]>([]);
  const [formFlow, setFormFlow] = React.useState<Flow>("medium");
  const [formNotes, setFormNotes] = React.useState<string>("");

  const keyRef = React.useRef<CryptoKey | null>(null);

  const isLoggedIn = mounted && status === "authenticated" && !!session?.user;

  /* ---------- Mount : initialise clé + charge données ---------- */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setMounted(true);
      const today = new Date();
      if (!cancelled) {
        setNow(today);
        setViewYear(today.getUTCFullYear());
        setViewMonth(today.getUTCMonth());
      }
      try {
        const key = await getOrCreateDeviceKey();
        if (cancelled) return;
        keyRef.current = key;

        // 1. Charger depuis localStorage
        let blob = loadBlobFromLS();

        // 2. Si authentifié·e, tenter de pull le blob cloud (plus récent)
        if (isLoggedIn) {
          try {
            const res = await fetch("/api/cycle/sync", { cache: "no-store" });
            if (res.ok) {
              const data = (await res.json()) as {
                cycle: EncryptedBlob | null;
              };
              if (data.cycle) {
                // Comparer updatedAt : prendre le plus récent
                const cloudUpdated = new Date(data.cycle.updatedAt).getTime();
                const localUpdated = blob
                  ? new Date(blob.updatedAt).getTime()
                  : 0;
                if (cloudUpdated > localUpdated) {
                  blob = data.cycle;
                  saveBlobToLS(blob);
                }
                setLastSyncAt(data.cycle.updatedAt);
              }
            }
          } catch {
            // réseau KO → on garde le blob local
          }
        }

        if (blob) {
          try {
            const decrypted = await decryptCycles(blob, key);
            if (!cancelled) setCycles(decrypted);
          } catch {
            // blob corrompu ou clé changée → on repart de zéro
            if (!cancelled) setCycles([]);
          }
        }
      } catch (err) {
        console.error("[CycleSection] init error:", err);
        toast.error("Impossible d'initialiser le calendrier.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  /* ---------- Persist + sync ---------- */
  const persistAndSync = React.useCallback(
    async (next: CycleEntry[]) => {
      const key = keyRef.current;
      if (!key) return;
      try {
        const blob = await encryptCycles(next, key);
        saveBlobToLS(blob);
        setLastSyncAt(blob.updatedAt);

        if (isLoggedIn) {
          setSyncing(true);
          try {
            const res = await fetch("/api/cycle/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                encryptedBlob: blob.ciphertext,
                iv: blob.iv,
                cycleCount: blob.cycleCount,
                version: blob.version,
              }),
            });
            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as {
                error?: string;
              };
              toast.error(err.error ?? "Sync cloud échouée (local OK).");
            } else {
              toast.success("Cycle sauvegardé (cloud + local).", {
                duration: 2500,
              });
            }
          } catch {
            toast.success("Cycle sauvegardé localement.", { duration: 2500 });
          } finally {
            setSyncing(false);
          }
        } else {
          toast.success("Cycle sauvegardé localement.", { duration: 2500 });
        }
      } catch (err) {
        console.error("[CycleSection] persist error:", err);
        toast.error("Erreur de sauvegarde.");
      }
    },
    [isLoggedIn],
  );

  /* ---------- Ajout d'un cycle ---------- */
  const openAddDialog = React.useCallback(() => {
    if (!now) return;
    // Pré-remplir avec la date du jour (UTC YYYY-MM-DD)
    setFormDate(formatDate(todayUTC(now)));
    setFormEndDate("");
    setFormSymptoms([]);
    setFormFlow("medium");
    setFormNotes("");
    setDialogOpen(true);
  }, [now]);

  const handleSaveCycle = React.useCallback(async () => {
    if (!formDate) {
      toast.error("Choisis une date de début.");
      return;
    }
    const entry: CycleEntry = {
      startDate: formDate,
      endDate: formEndDate || undefined,
      symptoms: formSymptoms,
      flow: formFlow,
      notes: formNotes.trim() || undefined,
    };
    // Éviter doublon : si même startDate existe, on remplace
    const filtered = cycles.filter((c) => c.startDate !== entry.startDate);
    const next = [...filtered, entry];
    setCycles(next);
    setDialogOpen(false);
    await persistAndSync(next);
  }, [formDate, formEndDate, formSymptoms, formFlow, formNotes, cycles, persistAndSync]);

  const handleDeleteCycle = React.useCallback(
    async (startDate: string) => {
      const next = cycles.filter((c) => c.startDate !== startDate);
      setCycles(next);
      await persistAndSync(next);
      toast.success("Cycle supprimé.");
    },
    [cycles, persistAndSync],
  );

  /* ---------- Calculs prédictions (côté client, après mount) ---------- */
  const predictions = React.useMemo(() => {
    if (!now || cycles.length === 0) return null;
    const { nextDate, confidence } = predictNextPeriod(cycles, now);
    const fertile = predictFertileWindow(nextDate);
    const ovulation = predictOvulation(nextDate);
    const late = isLate(cycles, now);
    const cycleLen = averageCycleLength(cycles);
    const periodLen = averagePeriodLength(cycles);
    const daysUntil = diffDays(todayUTC(now), nextDate);
    return {
      nextDate,
      confidence,
      fertile,
      ovulation,
      late,
      cycleLen,
      periodLen,
      daysUntil,
    };
  }, [cycles, now]);

  /* ---------- Données calendrier ---------- */
  const monthGrid = React.useMemo(() => {
    if (!mounted || viewYear === 0) return [];
    return getMonthGrid(viewYear, viewMonth);
  }, [mounted, viewYear, viewMonth]);

  // Index des jours marqués pour lookup rapide
  const periodDays = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of cycles) {
      set.add(c.startDate);
      if (c.endDate) {
        const start = parseDate(c.startDate);
        const end = parseDate(c.endDate);
        let cur = start;
        while (cur.getTime() <= end.getTime()) {
          set.add(formatDate(cur));
          cur = addDays(cur, 1);
        }
      } else {
        // Si pas de endDate, marquer les 5 jours suivant startDate (durée moyenne)
        const start = parseDate(c.startDate);
        for (let i = 1; i < 5; i++) {
          set.add(formatDate(addDays(start, i)));
        }
      }
    }
    return set;
  }, [cycles]);

  const fertileStart = predictions?.fertile.start ?? null;
  const fertileEnd = predictions?.fertile.end ?? null;
  const ovulationDate = predictions?.ovulation ?? null;
  const todayIso = now ? formatDate(todayUTC(now)) : null;

  /* ---------- Navigation mois ---------- */
  const goPrevMonth = React.useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);
  const goNextMonth = React.useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);
  const goToday = React.useCallback(() => {
    if (!now) return;
    setViewYear(now.getUTCFullYear());
    setViewMonth(now.getUTCMonth());
  }, [now]);

  const toggleSymptom = (s: CycleSymptom) => {
    setFormSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  /* =========================================================
     RENDU
     ========================================================= */

  if (!mounted) {
    // SSR : placeholder sans Date pour éviter mismatch hydration
    return (
      <div className="bg-creme-baobab rounded-2xl border border-ocre-rouge/10 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-lg bg-terracotta/15 flex items-center justify-center">
            <CalendarDays className="size-4 text-terracotta" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-terre-brulee">
              Calendrier menstruel
            </h2>
            <p className="text-[11px] text-ocre-rouge/70">
              Chargement…
            </p>
          </div>
        </div>
        <div className="h-32 animate-pulse rounded-xl bg-ocre-rouge/5" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-creme-baobab rounded-2xl border border-ocre-rouge/10 p-4 shadow-sm">
        {/* En-tête */}
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-lg bg-terracotta/15 flex items-center justify-center">
            <CalendarDays className="size-4 text-terracotta" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-terre-brulee">
              Calendrier menstruel
            </h2>
            <p className="text-[11px] text-ocre-rouge/70 flex items-center gap-1">
              <Lock className="size-3" aria-hidden="true" />
              Chiffré AES-256 · {isLoggedIn ? "Sync cloud" : "100% local"}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openAddDialog}
            disabled={loading}
            className="bg-terracotta text-creme-baobab hover:bg-ocre-rouge h-8 gap-1.5 px-3 text-xs"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Marquer mes règles
          </Button>
        </div>

        {/* Alerte retard > 5 jours */}
        {predictions?.late.late && predictions.late.daysLate > LATE_THRESHOLD_DAYS && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-terracotta/10 border border-terracotta/30"
          >
            <AlertTriangle
              className="size-4 text-terracotta shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-[11px] leading-snug text-terre-brulee">
              <p className="font-bold text-terracotta">
                Cycle en retard ? {predictions.late.daysLate} jours de retard.
              </p>
              <p className="mt-0.5 text-ocre-rouge/80">
                Si tu as eu des rapports sexuels, envisage un{" "}
                <span className="font-semibold">test de grossesse</span>{" "}
                (pharmacie, ~500-1500 FCFA). Discret, fiable dès le 1er jour de retard.
              </p>
            </div>
          </div>
        )}

        {/* Carte prédictions */}
        {predictions && (
          <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Prochaines règles */}
            <div className="rounded-xl bg-terracotta/8 border border-terracotta/25 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Droplet
                  className="size-3 text-terracotta"
                  aria-hidden="true"
                />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-terracotta">
                  Prochaines règles
                </span>
              </div>
              <p className="text-sm font-bold text-terre-brulee">
                {formatHumanDate(predictions.nextDate)}
              </p>
              <p className="text-[11px] text-ocre-rouge/80">
                {formatRelativeDays(predictions.daysUntil)}
                {predictions.confidence > 0 && (
                  <span className="ml-1 opacity-70">
                    · ~{Math.round(predictions.confidence * 100)}%
                  </span>
                )}
              </p>
            </div>

            {/* Ovulation */}
            <div className="rounded-xl bg-vert-baobab/8 border border-vert-baobab/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles
                  className="size-3 text-vert-baobab"
                  aria-hidden="true"
                />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-vert-baobab">
                  Ovulation
                </span>
              </div>
              <p className="text-sm font-bold text-terre-brulee">
                {formatHumanDate(predictions.ovulation)}
              </p>
              <p className="text-[11px] text-ocre-rouge/80">
                Jour le plus fertile
              </p>
            </div>

            {/* Fenêtre fertile */}
            <div className="rounded-xl bg-ambre-couchant/10 border border-ambre-couchant/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Heart
                  className="size-3 text-ambre-couchant"
                  aria-hidden="true"
                />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-ambre-couchant">
                  Fenêtre fertile
                </span>
              </div>
              <p className="text-sm font-bold text-terre-brulee">
                {formatHumanDate(predictions.fertile.start)} →{" "}
                {formatHumanDate(predictions.fertile.end)}
              </p>
              <p className="text-[11px] text-ocre-rouge/80">
                {diffDays(predictions.fertile.start, predictions.fertile.end) + 1} jours
              </p>
            </div>
          </div>
        )}

        {/* Légende */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[10px] text-ocre-rouge/80">
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: "#B5684A" }}
              aria-hidden="true"
            />
            Règles
          </span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: "#2D4A2D" }}
              aria-hidden="true"
            />
            Ovulation
          </span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-sm"
              style={{ backgroundColor: "#F5C97A" }}
              aria-hidden="true"
            />
            Fenêtre fertile
          </span>
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-full border border-ocre-rouge"
              aria-hidden="true"
            />
            Aujourd&apos;hui
          </span>
        </div>

        {/* Navigation mois */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="Mois précédent"
            className="size-7 rounded-md hover:bg-ocre-rouge/10 flex items-center justify-center text-ocre-rouge"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="text-xs font-bold text-terre-brulee">
            {getMonthLabel(viewYear, viewMonth)}
          </span>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="Mois suivant"
            className="size-7 rounded-md hover:bg-ocre-rouge/10 flex items-center justify-center text-ocre-rouge"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Grille calendrier */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-[9px] uppercase font-semibold text-ocre-rouge/60 py-0.5"
            >
              {d}
            </div>
          ))}
          {monthGrid.map((date, i) => {
            if (!date) {
              return <div key={i} className="aspect-square" />;
            }
            const iso = formatDate(date);
            const isPeriod = periodDays.has(iso);
            const isFertile =
              fertileStart && fertileEnd
                ? isDateInRange(date, fertileStart, fertileEnd)
                : false;
            const isOvulation = ovulationDate
              ? iso === formatDate(ovulationDate)
              : false;
            const isToday = todayIso === iso;

            return (
              <div
                key={i}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center relative",
                  "border transition-colors",
                  isFertile
                    ? "bg-ambre-couchant/15 border-ambre-couchant/30"
                    : "border-transparent",
                  isToday && "border-ocre-rouge ring-1 ring-ocre-rouge/40",
                )}
                title={
                  isPeriod
                    ? "Règles"
                    : isOvulation
                      ? "Ovulation prévue"
                      : isFertile
                        ? "Fenêtre fertile"
                        : undefined
                }
              >
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    isToday
                      ? "text-ocre-rouge font-bold"
                      : "text-terre-brulee/80",
                  )}
                >
                  {date.getUTCDate()}
                </span>
                {/* Point période */}
                {isPeriod && (
                  <span
                    className="absolute bottom-0.5 size-1.5 rounded-full"
                    style={{ backgroundColor: "#B5684A" }}
                    aria-hidden="true"
                  />
                )}
                {/* Point ovulation */}
                {isOvulation && (
                  <span
                    className="absolute bottom-0.5 size-1.5 rounded-full"
                    style={{ backgroundColor: "#2D4A2D" }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Bouton "Aujourd'hui" */}
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={goToday}
            className="text-[10px] text-ocre-rouge/70 hover:text-ocre-rouge underline underline-offset-2"
          >
            Revenir à aujourd&apos;hui
          </button>
        </div>

        {/* Stats cycles enregistrés */}
        {cycles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-ocre-rouge/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-ocre-rouge/80">
                {cycles.length} cycle{cycles.length > 1 ? "s" : ""} enregistré
                {cycles.length > 1 ? "s" : ""}
              </span>
              {predictions && (
                <span className="text-[11px] text-ocre-rouge/70">
                  Cycle moyen : {predictions.cycleLen}j · Règles :{" "}
                  {predictions.periodLen}j
                </span>
              )}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 aya-scroll">
              {[...cycles]
                .sort(
                  (a, b) =>
                    parseDate(b.startDate).getTime() -
                    parseDate(a.startDate).getTime(),
                )
                .map((c) => (
                  <div
                    key={c.startDate}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-ocre-rouge/5 hover:bg-ocre-rouge/10 transition-colors group"
                  >
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          FLOW_OPTIONS.find((f) => f.value === c.flow)
                            ?.color ?? "#B5684A",
                      }}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-terre-brulee">
                        {formatHumanDate(parseDate(c.startDate))}
                        {c.endDate &&
                          ` → ${formatHumanDate(parseDate(c.endDate))}`}
                      </p>
                      <p className="text-[10px] text-ocre-rouge/70 truncate">
                        {FLOW_LABELS[c.flow]}
                        {c.symptoms.length > 0 &&
                          ` · ${c.symptoms.map((s) => SYMPTOM_LABELS[s]).join(", ")}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCycle(c.startDate)}
                      aria-label="Supprimer ce cycle"
                      className="size-6 rounded-md text-ocre-rouge/50 hover:bg-terracotta/15 hover:text-terracotta opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Sync status */}
        <div className="mt-3 pt-3 border-t border-ocre-rouge/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-ocre-rouge/70">
            {isLoggedIn ? (
              <>
                <Cloud className="size-3 text-ambre-couchant" aria-hidden="true" />
                <span>
                  {syncing
                    ? "Sync en cours…"
                    : lastSyncAt
                      ? `Sync ${formatRelativeDays(
                          diffDays(new Date(lastSyncAt), now ?? new Date()),
                        )}`
                      : "Sync cloud prêt"}
                </span>
              </>
            ) : (
              <>
                <CloudOff className="size-3" aria-hidden="true" />
                <span>Local uniquement · connecte-toi pour sync cloud</span>
              </>
            )}
          </div>
          {loading && (
            <span className="text-[10px] text-ocre-rouge/60">Chargement…</span>
          )}
        </div>
      </div>

      {/* Dialog "Marquer mes règles" */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays
                className="size-4 text-terracotta"
                aria-hidden="true"
              />
              Marquer mes règles
            </DialogTitle>
            <DialogDescription>
              Renseigne les détails de ce cycle. Tout est chiffré localement avant
              toute synchronisation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date de début */}
            <div className="space-y-1.5">
              <label
                htmlFor="cycle-start"
                className="text-xs font-semibold text-terre-brulee"
              >
                Date de début <span className="text-terracotta">*</span>
              </label>
              <input
                id="cycle-start"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                max={formatDate(todayUTC(now ?? new Date()))}
                className="w-full px-3 py-2 rounded-lg border border-ocre-rouge/20 bg-creme-baobab text-sm text-terre-brulee focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>

            {/* Date de fin (optionnel) */}
            <div className="space-y-1.5">
              <label
                htmlFor="cycle-end"
                className="text-xs font-semibold text-terre-brulee"
              >
                Date de fin{" "}
                <span className="text-ocre-rouge/60 font-normal">
                  (optionnel)
                </span>
              </label>
              <input
                id="cycle-end"
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                min={formDate || undefined}
                className="w-full px-3 py-2 rounded-lg border border-ocre-rouge/20 bg-creme-baobab text-sm text-terre-brulee focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>

            {/* Flux */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-terre-brulee">
                Flux
              </span>
              <div className="grid grid-cols-3 gap-2">
                {FLOW_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFormFlow(f.value)}
                    aria-pressed={formFlow === f.value}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors",
                      formFlow === f.value
                        ? "border-terracotta bg-terracotta/10 text-terre-brulee"
                        : "border-ocre-rouge/20 text-ocre-rouge/80 hover:bg-ocre-rouge/5",
                    )}
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: f.color }}
                      aria-hidden="true"
                    />
                    {FLOW_LABELS[f.value]}
                  </button>
                ))}
              </div>
            </div>

            {/* Symptômes */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-terre-brulee">
                Mes symptômes{" "}
                <span className="text-ocre-rouge/60 font-normal">
                  (optionnel)
                </span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {CYCLE_SYMPTOMS.map((s) => {
                  const active = formSymptoms.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSymptom(s)}
                      aria-pressed={active}
                      className={cn(
                        "px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-colors text-left",
                        active
                          ? "border-terracotta bg-terracotta/10 text-terre-brulee"
                          : "border-ocre-rouge/15 text-ocre-rouge/80 hover:bg-ocre-rouge/5",
                      )}
                    >
                      {SYMPTOM_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label
                htmlFor="cycle-notes"
                className="text-xs font-semibold text-terre-brulee"
              >
                Notes{" "}
                <span className="text-ocre-rouge/60 font-normal">
                  (optionnel)
                </span>
              </label>
              <Textarea
                id="cycle-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Humeur, douleurs particulières, médicaments…"
                rows={2}
                className="text-sm resize-none bg-creme-baobab"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-ocre-rouge/70 hover:text-terre-brulee"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveCycle}
              disabled={!formDate}
              className="bg-terracotta text-creme-baobab hover:bg-ocre-rouge gap-1.5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CycleSection;
