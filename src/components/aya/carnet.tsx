"use client";

/**
 * Sankofa — Carnet de santé chiffré (V3)
 *
 * 3 états :
 *  - Setup    (première ouverture : choix PIN + confirmation)
 *  - Locked   (PIN déjà configuré : saisie PIN avec clavier numérique)
 *  - Unlocked (carnet déverrouillé : tabs + entries + actions)
 *
 * Sécurité :
 *  - 5 essais max avant wipe (warning progressif à 3, 4, 5)
 *  - Auto-lock après 5 min (warning à 4 min 30)
 *  - Export/Import .aya (blob chiffré)
 *
 * Accessibilité :
 *  - Clavier numérique accessible (0-9, Backspace, Enter)
 *  - ARIA labels, role="alert" pour les messages critiques
 *  - Pas de couleur seule pour transmettre l'info
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Trash2,
  Plus,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ChevronLeft,
  Pencil,
  X,
  Bell,
  Stethoscope,
  FlaskConical,
  FileText,
  AlertOctagon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SankofaLogo } from "@/components/aya/sankofa-logo";
import {
  isCarnetSetup,
  setupCarnet,
  unlockCarnet,
  lockCarnet,
  wipeCarnet,
  addEntry,
  updateEntry,
  deleteEntry,
  listEntries,
  exportEncrypted,
  importEncrypted,
  onAutoLockWarn,
  onLock,
  isUnlocked,
  touchCarnet,
  CARNET_MAX_ATTEMPTS,
  type CarnetEntry,
  type CarnetEntryType,
  type CarnetEntryData,
} from "@/lib/carnet/service";

/* =========================================================
   CONSTANTES UI
   ========================================================= */

type CarnetView = "loading" | "setup" | "locked" | "unlocked";

const TABS: { value: CarnetEntryType; label: string; icon: typeof Lock }[] = [
  { value: "consultation", label: "Consultations", icon: Stethoscope },
  { value: "test", label: "Tests", icon: FlaskConical },
  { value: "rappel", label: "Rappels", icon: Bell },
  { value: "note", label: "Notes", icon: FileText },
  { value: "allergie", label: "Allergies/Antécédents", icon: AlertOctagon },
];

const PERSONA_OPTIONS: Array<{ value: "Aya" | "Yao" | "Tonton Koffi"; label: string }> = [
  { value: "Aya", label: "Aya (Grande sœur)" },
  { value: "Yao", label: "Yao (Grand frère)" },
  { value: "Tonton Koffi", label: "Tonton Koffi (Médecin)" },
];

const SEVERITY_OPTIONS: Array<{ value: "legere" | "moderee" | "severe"; label: string }> = [
  { value: "legere", label: "Légère" },
  { value: "moderee", label: "Modérée" },
  { value: "severe", label: "Sévère" },
];

/* =========================================================
   HOOK — état global du carnet
   ========================================================= */

function useCarnetState() {
  const [view, setView] = React.useState<CarnetView>("loading");
  const [wiped, setWiped] = React.useState(false);
  const [warnAutoLock, setWarnAutoLock] = React.useState(false);

  // Init : vérifie si le carnet est déjà configuré
  React.useEffect(() => {
    let mounted = true;
    isCarnetSetup()
      .then((ok) => {
        if (!mounted) return;
        if (ok) setView("locked");
        else setView("setup");
      })
      .catch(() => {
        if (mounted) setView("setup");
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Listen auto-lock warning
  React.useEffect(() => {
    const offWarn = onAutoLockWarn(() => setWarnAutoLock(true));
    const offLock = onLock(() => {
      setWarnAutoLock(false);
      if (typeof window !== "undefined") {
        // Re-check carnet setup (could be wiped)
        isCarnetSetup().then((ok) => setView(ok ? "locked" : "setup"));
      }
    });
    return () => {
      offWarn();
      offLock();
    };
  }, []);

  // Touch carnet sur activity (évite auto-lock pendant usage actif)
  React.useEffect(() => {
    if (view !== "unlocked") return;
    const handler = () => touchCarnet();
    const events = ["click", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [view]);

  return {
    view,
    setView,
    wiped,
    setWiped,
    warnAutoLock,
    setWarnAutoLock,
  };
}

/* =========================================================
   COMPOSANT — clavier PIN numérique
   ========================================================= */

interface PinKeypadProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

function PinKeypad({ value, onChange, onSubmit, disabled }: PinKeypadProps) {
  // Track latest onSubmit in a ref so the auto-submit effect always calls
  // the freshest version (avoids stale closure issues with setTimeout).
  const onSubmitRef = React.useRef(onSubmit);
  React.useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  // Auto-submit quand value atteint 6 chiffres — via useEffect pour
  // garantir que le submit se déclenche même si onChange n'a pas encore
  // propagé la valeur au moment du clic.
  React.useEffect(() => {
    if (value.length === 6 && !disabled) {
      // Micro-delay pour laisser le temps à l'UI de mettre à jour les dots
      // avant que le parent ne déclenche le loading/unlock.
      const t = setTimeout(() => {
        if (onSubmitRef.current) onSubmitRef.current(value);
      }, 80);
      return () => clearTimeout(t);
    }
  }, [value, disabled]);

  const press = (d: string) => {
    if (disabled) return;
    if (value.length >= 6) return;
    const next = value + d;
    onChange(next);
    // Double safety : appelle aussi onSubmit directement si jamais l'effet
    // ne se déclenche pas (par exemple si React batch trop de re-renders).
    if (next.length === 6 && !disabled) {
      setTimeout(() => {
        if (onSubmitRef.current) onSubmitRef.current(next);
      }, 150);
    }
  };
  const backspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  // Accessibilité clavier
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= "0" && e.key <= "9") {
        press(e.key);
      } else if (e.key === "Backspace") {
        backspace();
      } else if (e.key === "Enter" && value.length === 6) {
        onSubmit(value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
     
  }, [value, disabled]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div
      className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto"
      role="group"
      aria-label="Clavier numérique pour le code PIN"
    >
      {keys.map((k, i) => {
        if (k === "") return <div key={`empty-${i}`} aria-hidden="true" />;
        if (k === "⌫") {
          return (
            <button
              key="backspace"
              type="button"
              onClick={backspace}
              disabled={disabled || value.length === 0}
              aria-label="Effacer le dernier chiffre"
              className="h-16 rounded-xl bg-creme-baobab border border-ocre-rouge/30 text-text-on-light hover:bg-sable-dore/60 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center aya-btn-press"
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          );
        }
        return (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={disabled}
            aria-label={`Chiffre ${k}`}
            className="h-16 rounded-xl bg-creme-baobab border border-ocre-rouge/30 text-2xl font-bold text-text-on-light hover:bg-sable-dore/60 active:scale-95 transition-all disabled:opacity-40 aya-btn-press"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================
   COMPOSANT — 6 dots PIN indicator
   ========================================================= */

function PinDots({ value, error }: { value: string; error?: boolean }) {
  return (
    <div
      className="flex items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={`${value.length} chiffre${value.length > 1 ? "s" : ""} saisi${value.length > 1 ? "s" : ""} sur 6`}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "size-4 rounded-full transition-all duration-150",
            error
              ? "bg-ocre-rouge scale-110"
              : i < value.length
                ? "bg-terracotta scale-110"
                : "bg-ocre-rouge/20",
          )}
        />
      ))}
    </div>
  );
}

/* =========================================================
   VUE — Setup (première ouverture)
   ========================================================= */

function SetupView({
  onDone,
}: {
  onDone: () => void;
}) {
  const [step, setStep] = React.useState<"choose" | "confirm">("choose");
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleChooseSubmit = (pinValue?: string) => {
    const v = pinValue ?? pin;
    if (v.length !== 6) return;
    setPin(v);
    setStep("confirm");
    setConfirm("");
  };

  const handleConfirmSubmit = async (confirmValue?: string) => {
    const v = confirmValue ?? confirm;
    if (v.length !== 6) return;
    if (pin !== v) {
      toast.error("Les codes ne correspondent pas", {
        description: "Recommence la confirmation.",
      });
      setConfirm("");
      return;
    }
    setLoading(true);
    try {
      await setupCarnet(pin);
      toast.success("Carnet chiffré créé 🔒", {
        description: "Ton PIN est le seul moyen d'y accéder. Mémorise-le bien.",
      });
      onDone();
    } catch (err) {
      toast.error("Erreur d'initialisation", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="mb-6 flex justify-center">
        <div className="size-16 rounded-full bg-terracotta/15 border-2 border-terracotta/40 flex items-center justify-center aya-glow-ambre">
          <Lock className="size-8 text-terracotta" />
        </div>
      </div>
      <h3 className="text-2xl font-black text-text-on-light mb-2" style={{ fontFamily: "var(--font-bricolage)" }}>
        {step === "choose" ? "Choisis ton code PIN" : "Confirme ton code PIN"}
      </h3>
      <p className="text-sm text-text-on-light-muted mb-2">
        {step === "choose"
          ? "6 chiffres. Ce PIN protège ton carnet de santé chiffré."
          : "Retape les mêmes 6 chiffres pour vérifier."}
      </p>
      <div className="mb-6 p-3 rounded-lg bg-ambre-couchant/15 border border-ambre-couchant/40 flex items-start gap-2 text-left">
        <AlertTriangle className="size-4 text-ocre-rouge shrink-0 mt-0.5" />
        <p className="text-xs text-text-on-light-muted leading-relaxed">
          <strong className="text-text-accent">Si tu oublies ce PIN, ton carnet sera irrécupérable.</strong>{" "}
          Chiffrement de bout en bout : aucune récupération possible, ni par nous, ni par personne.
          Note-le dans un endroit sûr.
        </p>
      </div>

      <div className="mb-6">
        <PinDots value={step === "choose" ? pin : confirm} />
      </div>

      <div className="mb-6">
        <PinKeypad
          value={step === "choose" ? pin : confirm}
          onChange={step === "choose" ? setPin : setConfirm}
          onSubmit={step === "choose" ? handleChooseSubmit : handleConfirmSubmit}
          disabled={loading}
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        {step === "confirm" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStep("choose");
              setPin("");
              setConfirm("");
            }}
            disabled={loading}
          >
            <ChevronLeft className="size-4" />
            Retour
          </Button>
        )}
        <Button
          type="button"
          onClick={step === "choose" ? () => handleChooseSubmit() : () => handleConfirmSubmit()}
          disabled={loading || (step === "choose" ? pin.length !== 6 : confirm.length !== 6)}
          className="aya-btn-press bg-terracotta hover:bg-ocre-rouge text-text-on-dark"
        >
          {loading ? (
            <>
              <span className="aya-typing-dot size-2 rounded-full bg-text-on-dark inline-block" />
              <span className="aya-typing-dot size-2 rounded-full bg-text-on-dark inline-block" />
              <span className="aya-typing-dot size-2 rounded-full bg-text-on-dark inline-block" />
            </>
          ) : step === "choose" ? (
            "Continuer"
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Activer le carnet
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   VUE — Locked (saisie PIN)
   ========================================================= */

function LockedView({
  onUnlock,
  wiped,
  onWipeAcknowledged,
}: {
  onUnlock: () => void;
  wiped: boolean;
  onWipeAcknowledged: () => void;
}) {
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState(false);
  const [attemptsLeft, setAttemptsLeft] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (wiped) {
      setError(true);
    }
  }, [wiped]);

  const handleSubmit = async (pinValue?: string) => {
    const v = pinValue ?? pin;
    if (v.length !== 6 || loading) return;
    setLoading(true);
    setError(false);
    try {
      const result = await unlockCarnet(v);
      if (result.success) {
        setPin("");
        setAttemptsLeft(null);
        onUnlock();
      } else {
        setError(true);
        setPin("");
        if (result.wiped) {
          toast.error("Carnet effacé", {
            description: "5 tentatives incorrectes. Toutes les données ont été supprimées.",
          });
          onWipeAcknowledged();
        } else if (result.attemptsLeft !== undefined) {
          setAttemptsLeft(result.attemptsLeft);
          if (result.attemptsLeft <= 2) {
            toast.warning(`Plus que ${result.attemptsLeft} tentative${result.attemptsLeft > 1 ? "s" : ""}`, {
              description: `À ${CARNET_MAX_ATTEMPTS - result.attemptsLeft + 1} essais, le carnet sera effacé définitivement.`,
            });
          }
        }
      }
    } catch (err) {
      toast.error("Erreur de déverrouillage", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  };

  if (wiped) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="mb-6 flex justify-center">
          <div className="size-16 rounded-full bg-ocre-rouge/15 border-2 border-ocre-rouge/40 flex items-center justify-center">
            <AlertTriangle className="size-8 text-ocre-rouge" />
          </div>
        </div>
        <h3 className="text-2xl font-black text-text-on-light mb-3" style={{ fontFamily: "var(--font-bricolage)" }}>
          Carnet effacé
        </h3>
        <p className="text-sm text-text-on-light-muted mb-6">
          Pour ta sécurité, le carnet a été <strong>complètement effacé</strong> après{" "}
          {CARNET_MAX_ATTEMPTS} tentatives de PIN incorrectes. Aucune donnée n'est récupérable.
          Tu peux recréer un nouveau carnet avec un nouveau PIN.
        </p>
        <Button
          onClick={onWipeAcknowledged}
          className="aya-btn-press bg-terracotta hover:bg-ocre-rouge text-text-on-dark"
        >
          Recréer un carnet
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="mb-6 flex justify-center">
        <div className="size-16 rounded-full bg-ocre-rouge/15 border-2 border-ocre-rouge/40 flex items-center justify-center aya-glow-soft">
          <Lock className="size-8 text-ocre-rouge" />
        </div>
      </div>
      <h3 className="text-2xl font-black text-text-on-light mb-2" style={{ fontFamily: "var(--font-bricolage)" }}>
        Déverrouille ton carnet
      </h3>
      <p className="text-sm text-text-on-light-muted mb-6">
        Saisis ton code PIN à 6 chiffres.
      </p>

      <div className="mb-4">
        <PinDots value={pin} error={error} />
      </div>

      {attemptsLeft !== null && attemptsLeft < CARNET_MAX_ATTEMPTS && (
        <div
          role="alert"
          className={cn(
            "mb-4 p-2.5 rounded-lg border text-xs font-medium",
            attemptsLeft <= 2
              ? "bg-ocre-rouge/15 border-ocre-rouge/50 text-ocre-rouge"
              : "bg-ambre-couchant/15 border-ambre-couchant/40 text-ocre-rouge",
          )}
        >
          {attemptsLeft} tentative{attemptsLeft > 1 ? "s" : ""} restante{attemptsLeft > 1 ? "s" : ""}
          {attemptsLeft <= 2 && " · Le carnet sera effacé à la prochaine erreur"}
        </div>
      )}

      <div className="mb-6">
        <PinKeypad
          value={pin}
          onChange={setPin}
          onSubmit={handleSubmit}
          disabled={loading}
        />
      </div>
    </div>
  );
}

/* =========================================================
   FORM — création / édition d'entrée
   ========================================================= */

interface EntryFormProps {
  type: CarnetEntryType;
  initial?: CarnetEntryData;
  onSubmit: (data: CarnetEntryData) => Promise<void>;
  onCancel: () => void;
}

function EntryForm({ type, initial, onSubmit, onCancel }: EntryFormProps) {
  const [data, setData] = React.useState<CarnetEntryData>(initial ?? {});
  const [loading, setLoading] = React.useState(false);

  const set = (patch: Partial<CarnetEntryData>) => setData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(data);
    } catch (err) {
      toast.error("Erreur d'enregistrement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAllergie = type === "allergie" || type === "antecedent";

  return (
    <div className="space-y-4 text-left">
      {/* Consultation */}
      {type === "consultation" && (
        <>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={data.date ?? ""}
              onChange={(e) => set({ date: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="motif">Motif</Label>
            <Input
              id="motif"
              placeholder="Ex. rapport non protégé, brûlure..."
              value={data.motif ?? ""}
              onChange={(e) => set({ motif: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="persona">Persona consulté</Label>
            <select
              id="persona"
              value={data.persona ?? ""}
              onChange={(e) => set({ persona: (e.target.value || undefined) as CarnetEntryData["persona"] })}
              className="w-full h-9 px-3 rounded-md bg-creme-baobab border border-ocre-rouge/30 text-sm"
            >
              <option value="">— Aucun —</option>
              {PERSONA_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="resume">Résumé</Label>
            <Textarea
              id="resume"
              rows={4}
              placeholder="Ce qu'il faut retenir de la consultation..."
              value={data.resume ?? ""}
              onChange={(e) => set({ resume: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="orientation">Orientation /下一步</Label>
            <Input
              id="orientation"
              placeholder="Ex. RDV AIBEF, test VIH dans 4 semaines..."
              value={data.orientation ?? ""}
              onChange={(e) => set({ orientation: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
        </>
      )}

      {/* Test */}
      {type === "test" && (
        <>
          <div>
            <Label htmlFor="test-date">Date</Label>
            <Input
              id="test-date"
              type="date"
              value={data.date ?? ""}
              onChange={(e) => set({ date: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="test-type">Type de test</Label>
            <Input
              id="test-type"
              placeholder="Ex. VIH, syphilis, grossesse..."
              value={data.testType ?? ""}
              onChange={(e) => set({ testType: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="test-result">Résultat</Label>
            <Textarea
              id="test-result"
              rows={3}
              placeholder="Ex. Négatif, à confirmer dans 3 mois..."
              value={data.testResult ?? ""}
              onChange={(e) => set({ testResult: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="next-appt">Prochain rendez-vous</Label>
            <Input
              id="next-appt"
              type="date"
              value={data.nextAppointment ?? ""}
              onChange={(e) => set({ nextAppointment: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
        </>
      )}

      {/* Rappel */}
      {type === "rappel" && (
        <>
          <div>
            <Label htmlFor="reminder-date">Date du rappel</Label>
            <Input
              id="reminder-date"
              type="date"
              value={data.reminderDate ?? ""}
              onChange={(e) => set({ reminderDate: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="reminder-motif">Motif</Label>
            <Input
              id="reminder-motif"
              placeholder="Ex. Test VIH à 3 mois, prise de pilule..."
              value={data.reminderMotif ?? ""}
              onChange={(e) => set({ reminderMotif: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="recurring"
              type="checkbox"
              checked={!!data.recurring}
              onChange={(e) => set({ recurring: e.target.checked })}
              className="size-4"
            />
            <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">
              Récurrence (renouveler automatiquement)
            </Label>
          </div>
        </>
      )}

      {/* Note */}
      {type === "note" && (
        <div>
          <Label htmlFor="content">Ta note</Label>
          <Textarea
            id="content"
            rows={6}
            placeholder="Ce que tu veux garder en mémoire... (questions, ressentis, infos à ne pas oublier)"
            value={data.content ?? ""}
            onChange={(e) => set({ content: e.target.value })}
            className="bg-creme-baobab"
          />
        </div>
      )}

      {/* Allergie / Antécédent */}
      {isAllergie && (
        <>
          <div>
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              placeholder={type === "allergie" ? "Ex. Pénicilline, latex..." : "Ex. Asthme, diabète..."}
              value={data.label ?? ""}
              onChange={(e) => set({ label: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
          <div>
            <Label htmlFor="severity">Sévérité</Label>
            <select
              id="severity"
              value={data.severity ?? ""}
              onChange={(e) => set({ severity: (e.target.value || undefined) as CarnetEntryData["severity"] })}
              className="w-full h-9 px-3 rounded-md bg-creme-baobab border border-ocre-rouge/30 text-sm"
            >
              <option value="">— Non précisée —</option>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="note-detail">Détails (optionnel)</Label>
            <Textarea
              id="note-detail"
              rows={3}
              placeholder="Précisions, réaction, traitement..."
              value={data.content ?? ""}
              onChange={(e) => set({ content: e.target.value })}
              className="bg-creme-baobab"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annuler
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="aya-btn-press bg-terracotta hover:bg-ocre-rouge text-text-on-dark"
        >
          {loading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   CARTE — entrée de carnet
   ========================================================= */

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: CarnetEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const d = entry.data;
  const dateStr = d.date
    ? new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : d.reminderDate
      ? new Date(d.reminderDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : new Date(entry.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  return (
    <article className="rounded-lg border border-ocre-rouge/25 bg-card p-4 aya-lift">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-ocre-rouge">{dateStr}</span>
            {d.persona && (
              <Badge variant="outline" className="text-[10px] border-terracotta/40 text-terracotta">
                {d.persona}
              </Badge>
            )}
            {d.severity && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  d.severity === "severe"
                    ? "border-ocre-rouge/50 text-ocre-rouge bg-ocre-rouge/10"
                    : d.severity === "moderee"
                      ? "border-ambre-couchant/50 text-ocre-rouge bg-ambre-couchant/10"
                      : "border-vert-baobab/50 text-vert-baobab",
                )}
              >
                {d.severity}
              </Badge>
            )}
            {d.recurring && (
              <Badge variant="outline" className="text-[10px] border-terracotta/40 text-terracotta">
                Récurrent
              </Badge>
            )}
          </div>
          {d.motif && <h4 className="font-bold text-text-on-light text-sm">{d.motif}</h4>}
          {d.testType && <h4 className="font-bold text-text-on-light text-sm">Test : {d.testType}</h4>}
          {d.reminderMotif && <h4 className="font-bold text-text-on-light text-sm">{d.reminderMotif}</h4>}
          {d.label && <h4 className="font-bold text-text-on-light text-sm">{d.label}</h4>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Modifier cette entrée"
            className="p-1.5 rounded-md hover:bg-sable-dore/60 text-ocre-rouge transition-colors"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Supprimer cette entrée"
            className="p-1.5 rounded-md hover:bg-ocre-rouge/15 text-ocre-rouge transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {d.resume && <p className="text-sm text-text-on-light-muted whitespace-pre-wrap">{d.resume}</p>}
      {d.testResult && (
        <p className="text-sm text-text-on-light-muted">
          <strong>Résultat :</strong> {d.testResult}
        </p>
      )}
      {d.orientation && (
        <p className="text-sm text-text-on-light-muted mt-1">
          <strong className="text-ocre-rouge">→</strong> {d.orientation}
        </p>
      )}
      {d.nextAppointment && (
        <p className="text-sm text-text-on-light-muted mt-1">
          <strong>Prochain RDV :</strong>{" "}
          {new Date(d.nextAppointment).toLocaleDateString("fr-FR")}
        </p>
      )}
      {d.content && (entry.type === "note" || entry.type === "allergie" || entry.type === "antecedent") && (
        <p className="text-sm text-text-on-light-muted whitespace-pre-wrap">{d.content}</p>
      )}
    </article>
  );
}

/* =========================================================
   VUE — Unlocked (carnet ouvert)
   ========================================================= */

function UnlockedView({
  onLock,
  onWipe,
  prefill,
  onPrefillConsumed,
}: {
  onLock: () => void;
  onWipe: () => void;
  prefill: { type: CarnetEntryType; data: CarnetEntryData } | null;
  onPrefillConsumed: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<CarnetEntryType>("consultation");
  const [entries, setEntries] = React.useState<Record<CarnetEntryType, CarnetEntry[]>>({
    consultation: [],
    test: [],
    rappel: [],
    note: [],
    allergie: [],
    antecedent: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<CarnetEntry | null>(null);
  const [wipeOpen, setWipeOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Charge toutes les entries
  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const all = await listEntries();
      const grouped: Record<CarnetEntryType, CarnetEntry[]> = {
        consultation: [],
        test: [],
        rappel: [],
        note: [],
        allergie: [],
        antecedent: [],
      };
      for (const e of all) grouped[e.type].push(e);
      setEntries(grouped);
      // Dispatch un event global pour que la section carnet puisse afficher le compteur
      try {
        window.dispatchEvent(
          new CustomEvent("sankofa:carnet-count", { detail: { count: all.length } }),
        );
      } catch {}
    } catch (err) {
      toast.error("Erreur de chargement", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Prefill (depuis chat)
  React.useEffect(() => {
    if (prefill) {
      setActiveTab(prefill.type);
      setEditTarget(null);
      setFormOpen(true);
      onPrefillConsumed();
    }
     
  }, [prefill]);

  const handleAdd = (type: CarnetEntryType) => {
    setEditTarget(null);
    setActiveTab(type);
    setFormOpen(true);
  };

  const handleSubmit = async (data: CarnetEntryData) => {
    if (editTarget) {
      await updateEntry(editTarget.id, data);
      toast.success("Entrée mise à jour");
    } else {
      await addEntry({ type: activeTab, data });
      toast.success("Entrée ajoutée à ton carnet 🔒");
    }
    setFormOpen(false);
    setEditTarget(null);
    await refresh();
  };

  const handleEdit = (entry: CarnetEntry) => {
    setEditTarget(entry);
    setActiveTab(entry.type);
    setFormOpen(true);
  };

  const handleDelete = async (entry: CarnetEntry) => {
    try {
      await deleteEntry(entry.id);
      toast.success("Entrée supprimée");
      await refresh();
    } catch (err) {
      toast.error("Erreur", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportEncrypted();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aya-carnet-${new Date().toISOString().slice(0, 10)}.aya`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Carnet exporté", {
        description: "Fichier .aya chiffré téléchargé. Garde-le en lieu sûr.",
      });
    } catch (err) {
      toast.error("Erreur d'export", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pin = window.prompt(
      "Pour importer ce fichier, saisis le PIN qui l'a chiffré :",
    );
    if (!pin) {
      e.target.value = "";
      return;
    }
    try {
      await importEncrypted(file, pin);
      toast.success("Carnnet importé", {
        description: "Toutes les entrées ont été restaurées.",
      });
      await refresh();
    } catch (err) {
      toast.error("Erreur d'import", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      e.target.value = "";
    }
  };

  const handleWipe = async () => {
    try {
      await wipeCarnet();
      setWipeOpen(false);
      toast.success("Carnet effacé définitivement");
      onWipe();
    } catch (err) {
      toast.error("Erreur", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  };

  const currentEntries = entries[activeTab] ?? [];
  const isAllergieTab = activeTab === "allergie";

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-ocre-rouge/20">
        <div className="flex items-center gap-2">
          <Unlock className="size-4 text-vert-baobab" />
          <span className="text-sm font-semibold text-vert-baobab">Carnet déverrouillé</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="h-8 text-xs border-ocre-rouge/30"
          >
            <Download className="size-3.5" />
            Exporter
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 text-xs border-ocre-rouge/30"
          >
            <Upload className="size-3.5" />
            Importer
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".aya,application/octet-stream"
            onChange={handleImport}
            className="hidden"
            aria-label="Importer un fichier .aya chiffré"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onLock}
            className="h-8 text-xs border-ocre-rouge/30"
          >
            <Lock className="size-3.5" />
            Verrouiller
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setWipeOpen(true)}
            className="h-8 text-xs border-ocre-rouge/40 text-ocre-rouge hover:bg-ocre-rouge/10"
          >
            <Trash2 className="size-3.5" />
            Tout effacer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CarnetEntryType)}>
        <TabsList className="w-full flex-wrap h-auto justify-start bg-sable-dore/40">
          {TABS.map((t) => {
            const Icon = t.icon;
            const count = t.value === "allergie"
              ? (entries.allergie?.length ?? 0) + (entries.antecedent?.length ?? 0)
              : entries[t.value]?.length ?? 0;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value === "antecedent" ? "allergie" : t.value}
                className="text-xs gap-1.5 data-[state=active]:bg-terracotta data-[state=active]:text-text-on-dark"
              >
                <Icon className="size-3.5" />
                {t.label}
                {count > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-ocre-rouge/20 text-[10px]">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="consultation" className="mt-4">
          <EntryList
            type="consultation"
            entries={entries.consultation}
            loading={loading}
            onAdd={() => handleAdd("consultation")}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="test" className="mt-4">
          <EntryList
            type="test"
            entries={entries.test}
            loading={loading}
            onAdd={() => handleAdd("test")}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="rappel" className="mt-4">
          <EntryList
            type="rappel"
            entries={entries.rappel}
            loading={loading}
            onAdd={() => handleAdd("rappel")}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="note" className="mt-4">
          <EntryList
            type="note"
            entries={entries.note}
            loading={loading}
            onAdd={() => handleAdd("note")}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="allergie" className="mt-4">
          {/* Allergies + Antécédents combinés */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-ocre-rouge uppercase tracking-wide">Allergies</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd("allergie")}
                  className="h-7 text-xs border-ocre-rouge/30"
                >
                  <Plus className="size-3" />
                  Ajouter
                </Button>
              </div>
              <EntryListInline
                entries={entries.allergie}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyLabel="Aucune allergie enregistrée"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-ocre-rouge uppercase tracking-wide">Antécédents</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd("antecedent")}
                  className="h-7 text-xs border-ocre-rouge/30"
                >
                  <Plus className="size-3" />
                  Ajouter
                </Button>
              </div>
              <EntryListInline
                entries={entries.antecedent}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyLabel="Aucun antécédent enregistré"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog : formulaire */}
      <Dialog open={formOpen} onOpenChange={(o) => {
        setFormOpen(o);
        if (!o) setEditTarget(null);
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto aya-scroll">
          <DialogHeader>
            <DialogTitle className="text-text-on-light" style={{ fontFamily: "var(--font-bricolage)" }}>
              {editTarget ? "Modifier l'entrée" : `Nouvelle entrée — ${TABS.find((t) => t.value === activeTab)?.label}`}
            </DialogTitle>
            <DialogDescription className="text-text-on-light-muted">
              Chiffré en AES-256 avant stockage local. Jamais envoyé sur Internet.
            </DialogDescription>
          </DialogHeader>
          <EntryForm
            type={activeTab}
            initial={editTarget?.data}
            onSubmit={handleSubmit}
            onCancel={() => {
              setFormOpen(false);
              setEditTarget(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Alert dialog : wipe */}
      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ocre-rouge">
              Effacer DÉFINITIVEMENT tout le carnet ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Toutes les consultations,
              tests, rappels, notes, allergies et antécédents seront supprimés. Le PIN
              lui-même sera réinitialisé. Pense à <strong>exporter ton carnet</strong> d'abord
              si tu veux une sauvegarde chiffrée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipe}
              className="bg-ocre-rouge text-text-on-dark hover:bg-terre-brulee"
            >
              Oui, tout effacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EntryList({
  type,
  entries,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  type: CarnetEntryType;
  entries: CarnetEntry[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (e: CarnetEntry) => void;
  onDelete: (e: CarnetEntry) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-on-light-muted">
          {entries.length} entrée{entries.length > 1 ? "s" : ""}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          className="h-8 text-xs border-ocre-rouge/30"
        >
          <Plus className="size-3.5" />
          Ajouter
        </Button>
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm text-text-on-light-muted">Chargement...</div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center rounded-lg border border-dashed border-ocre-rouge/25 bg-creme-baobab/50">
          <p className="text-sm text-text-on-light-muted">Aucune entrée pour l'instant.</p>
          <Button
            type="button"
            size="sm"
            onClick={onAdd}
            className="mt-3 bg-terracotta hover:bg-ocre-rouge text-text-on-dark"
          >
            <Plus className="size-4" />
            Ajouter ma première entrée
          </Button>
        </div>
      ) : (
        <div className="grid gap-2.5 max-h-[60vh] overflow-y-auto aya-scroll pr-1">
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onEdit={() => onEdit(e)}
              onDelete={() => onDelete(e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryListInline({
  entries,
  loading,
  onEdit,
  onDelete,
  emptyLabel,
}: {
  entries: CarnetEntry[];
  loading: boolean;
  onEdit: (e: CarnetEntry) => void;
  onDelete: (e: CarnetEntry) => void;
  emptyLabel: string;
}) {
  if (loading) return <div className="py-4 text-center text-sm text-text-on-light-muted">Chargement...</div>;
  if (entries.length === 0) {
    return <p className="py-3 text-center text-xs text-text-on-light-muted">{emptyLabel}</p>;
  }
  return (
    <div className="grid gap-2">
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} onEdit={() => onEdit(e)} onDelete={() => onDelete(e)} />
      ))}
    </div>
  );
}

/* =========================================================
   COMPOSANT — Carnet complet (racine)
   ========================================================= */

export interface CarnetPrefill {
  type: CarnetEntryType;
  data: CarnetEntryData;
}

export interface CarnetProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefill?: CarnetPrefill | null;
  onPrefillConsumed?: () => void;
}

export function Carnet({ open, onOpenChange, prefill, onPrefillConsumed }: CarnetProps) {
  const { view, setView, wiped, setWiped, warnAutoLock, setWarnAutoLock } = useCarnetState();
  const [localPrefill, setLocalPrefill] = React.useState<CarnetPrefill | null>(null);

  // Sync external prefill -> local
  React.useEffect(() => {
    if (prefill) {
      setLocalPrefill(prefill);
      // Si carnet fermé, ouvre-le
      if (!open) onOpenChange(true);
      // Si locked ou setup, le prefill sera appliqué après unlock via effet dans UnlockedView
      if (view === "unlocked" && onPrefillConsumed) {
        // sera consommé par UnlockedView
      }
    }
     
  }, [prefill]);

  // Reset wiped quand on ferme
  React.useEffect(() => {
    if (!open) {
      setWiped(false);
      setWarnAutoLock(false);
    }
  }, [open, setWiped, setWarnAutoLock]);

  const handleUnlock = () => {
    setView("unlocked");
  };

  const handleSetupDone = () => {
    setView("unlocked");
  };

  const handleLock = () => {
    lockCarnet();
    setView("locked");
    setWarnAutoLock(false);
  };

  const handleWipe = () => {
    setView("setup");
    setWiped(false);
  };

  const handlePrefillConsumed = () => {
    setLocalPrefill(null);
    onPrefillConsumed?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-on-light" style={{ fontFamily: "var(--font-bricolage)" }}>
            <SankofaLogo size={24} />
            Mon carnet de santé chiffré
          </DialogTitle>
          <DialogDescription className="text-text-on-light-muted">
            Stockage local AES-256. Aucune donnée ne quitte ton téléphone.
          </DialogDescription>
        </DialogHeader>

        {/* Auto-lock warning */}
        <AnimatePresence>
          {warnAutoLock && view === "unlocked" && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-ambre-couchant/20 border border-ambre-couchant/50 text-ocre-rouge text-xs"
            >
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                Le carnet va se verrouiller dans 30s par sécurité.
              </span>
              <button
                type="button"
                onClick={() => {
                  touchCarnet();
                  setWarnAutoLock(false);
                }}
                className="underline font-semibold"
              >
                Garder ouvert
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-y-auto aya-scroll flex-1 -mx-1 px-1">
          {view === "loading" && (
            <div className="py-10 text-center text-sm text-text-on-light-muted">
              Chargement du carnet...
            </div>
          )}
          {view === "setup" && <SetupView onDone={handleSetupDone} />}
          {view === "locked" && (
            <LockedView
              onUnlock={handleUnlock}
              wiped={wiped}
              onWipeAcknowledged={() => {
                setWiped(false);
                setView("setup");
              }}
            />
          )}
          {view === "unlocked" && (
            <UnlockedView
              onLock={handleLock}
              onWipe={handleWipe}
              prefill={localPrefill}
              onPrefillConsumed={handlePrefillConsumed}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Carnet;
