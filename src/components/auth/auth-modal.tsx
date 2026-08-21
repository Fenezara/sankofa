"use client";

/**
 * Sankofa — AuthModal (Task 12)
 *
 * 2-step phone OTP authentication modal:
 *   Step 1 — Phone entry (+225 prefix, validation, "Envoyer le code")
 *   Step 2 — OTP verification (6-digit InputOTP, "Vérifier", "Renvoyer le code" 60s countdown)
 *
 * Key principle : Anonymity by default.
 *   - "Rester anonyme" button closes the modal without authenticating.
 *   - The user CAN create an account, but doesn't HAVE to.
 *
 * Design:
 *   - Warm Sankofa palette (terracotta, or-poudre-clair, sable-dore).
 *   - WhatsApp-style phone input with +225 prefix.
 *   - Large 6-digit OTP input (mobile-friendly, touch targets ≥ 44px).
 *   - Privacy note : "Ton numéro est hashé (SHA-256) et jamais stocké en clair."
 *
 * Flow:
 *   1. User types phone → POST /api/auth/otp/send → masked phone returned, OTP sent via WhatsApp (or dev log).
 *   2. User types 6-digit code → POST /api/auth/otp/verify → if valid, calls signIn("phone-otp").
 *   3. signIn creates JWT session (30 days), modal closes, parent re-renders with new session.
 *
 * Hydration-safe:
 *   - All state initialized in useState (no window/localStorage access during render).
 *   - Countdown timer in useEffect (not in render).
 *   - Modal renders null when closed (AnimatePresence).
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  MessageCircle,
  Shield,
  Lock,
  Loader2,
  ArrowLeft,
  Check,
  RefreshCw,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { SankofaLogo } from "@/components/aya/sankofa-logo";
import { signIn } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

type Step = "phone" | "otp" | "success";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when authentication succeeds (after signIn resolves). */
  onAuthenticated?: () => void;
  /** Called when user explicitly chooses to stay anonymous ("Rester anonyme"). */
  onStayAnonymous?: () => void;
}

const RESEND_COUNTDOWN_SECONDS = 60;

/** Validation côté client : numéro ivoirien (10 chiffres après +225). */
function isValidLocalPhone(input: string): boolean {
  const cleaned = input.replace(/\D/g, "");
  // Accepte "07XXXXXXXX", "0701020304" (10 chiffres commençant par 0 puis 1/5/7)
  return /^0[157]\d{8}$/.test(cleaned);
}

export function AuthModal({
  open,
  onOpenChange,
  onAuthenticated,
  onStayAnonymous,
}: AuthModalProps) {
  const [step, setStep] = React.useState<Step>("phone");
  const [phoneInput, setPhoneInput] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [maskedPhone, setMaskedPhone] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [resendCountdown, setResendCountdown] = React.useState(0);

  // Reset state when modal closes (propre pour ré-ouverture ultérieure)
  React.useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => {
        setStep("phone");
        setPhoneInput("");
        setOtp("");
        setMaskedPhone("");
        setResendCountdown(0);
      }, 250);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Countdown pour "Renvoyer le code" (60s)
  React.useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = window.setInterval(() => {
      setResendCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendCountdown]);

  const handleSendOtp = async () => {
    if (!isValidLocalPhone(phoneInput)) {
      toast.error("Numéro invalide", {
        description: "Format attendu : 07 01 02 03 04 (10 chiffres, préfixe 01/05/07).",
      });
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Envoi impossible", { description: data.error ?? `Erreur ${res.status}` });
        return;
      }
      setMaskedPhone(data.masked ?? "");
      setStep("otp");
      setResendCountdown(RESEND_COUNTDOWN_SECONDS);
      if (data.channel === "dev") {
        toast.info("Mode dev — code dans la console serveur", {
          description: "Vérifie le log du serveur de développement pour le code à 6 chiffres.",
        });
      } else {
        toast.success("Code envoyé par WhatsApp", {
          description: `Vérifie WhatsApp sur ${data.masked}. Le code expire dans 10 min.`,
        });
      }
    } catch {
      toast.error("Erreur réseau", { description: "Vérifie ta connexion et réessaie." });
    } finally {
      setIsSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Renvoi impossible", { description: data.error ?? `Erreur ${res.status}` });
        return;
      }
      setResendCountdown(RESEND_COUNTDOWN_SECONDS);
      setOtp("");
      toast.success("Nouveau code envoyé", {
        description: `Vérifie WhatsApp sur ${data.masked}.`,
      });
    } catch {
      toast.error("Erreur réseau", { description: "Vérifie ta connexion." });
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (codeArg?: string) => {
    const code = (codeArg ?? otp).trim();
    if (code.length !== 6) {
      toast.error("Code incomplet", { description: "Saisis les 6 chiffres du code." });
      return;
    }
    setIsVerifying(true);
    try {
      // 1. Pre-check via /api/auth/otp/verify (UX : feedback immédiat, consume l'OTP)
      const verifyRes = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, code }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        toast.error("Code invalide", {
          description:
            verifyData.error ??
            (typeof verifyData.attemptsRemaining === "number"
              ? `${verifyData.attemptsRemaining} tentative(s) restante(s).`
              : "Réessaie ou demande un nouveau code."),
        });
        return;
      }

      // 2. signIn("phone-otp") — crée la session JWT (30 jours)
      const signInResult = await signIn("phone-otp", {
        phone: phoneInput,
        code,
        redirect: false,
      });
      if (signInResult?.error) {
        toast.error("Connexion échouée", {
          description: "Le code était valide mais la session n'a pas pu être créée. Réessaie.",
        });
        return;
      }

      // Succès
      setStep("success");
      toast.success("Connecté·e 🌿", {
        description: `Bienvenue ! Ton numéro ${verifyData.masked ?? maskedPhone} est maintenant associé à ton compte.`,
      });
      onAuthenticated?.();
      // Ferme le modal après 1.2s (laisse voir l'état "success")
      window.setTimeout(() => {
        onOpenChange(false);
      }, 1200);
    } catch {
      toast.error("Erreur réseau", { description: "Vérifie ta connexion et réessaie." });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStayAnonymous = () => {
    onStayAnonymous?.();
    onOpenChange(false);
  };

  // Auto-submit OTP quand les 6 chiffres sont saisis.
  // handleVerify est une closure qui change à chaque render — on l'omet volontairement
  // des deps pour éviter une boucle (re-render → nouveau handleVerify → re-run).
  // (react-hooks/exhaustive-deps est désactivé dans eslint.config.mjs — pas de warning.)
  React.useEffect(() => {
    if (step === "otp" && otp.length === 6 && !isVerifying) {
      void handleVerify(otp);
    }
  }, [otp, step, isVerifying]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0 gap-0 border-ocre-rouge/30">
        {/* Header warm gradient */}
        <div
          className="relative px-6 pt-6 pb-5 text-text-on-dark"
          style={{
            background:
              "linear-gradient(135deg, #A8451F 0%, #7A2E12 60%, #3D1A0E 100%)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="size-10 rounded-xl bg-or-poudre-clair/15 border border-or-poudre-clair/30 flex items-center justify-center">
              <SankofaLogo size={26} />
            </span>
            <div>
              <DialogTitle
                className="text-xl font-bold text-text-on-dark"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                Connexion optionnelle
              </DialogTitle>
              <DialogDescription className="text-text-on-dark-soft text-xs">
                Pour sauvegarder ton carnet et activer la téléconsultation.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 bg-creme-baobab space-y-4">
          <AnimatePresence mode="wait">
            {/* === STEP 1 : PHONE === */}
            {step === "phone" && (
              <motion.div
                key="step-phone"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="auth-phone"
                    className="block text-xs font-medium text-ocre-rouge mb-1.5"
                  >
                    Ton numéro WhatsApp
                  </label>
                  <div className="flex items-stretch gap-2">
                    <div className="flex items-center px-3 rounded-md bg-sable-dore/60 border border-ocre-rouge/30 text-text-on-light text-sm font-semibold">
                      +225
                    </div>
                    <Input
                      id="auth-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="07 01 02 03 04"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSending) {
                          e.preventDefault();
                          void handleSendOtp();
                        }
                      }}
                      maxLength={14}
                      disabled={isSending}
                      className="flex-1 bg-background border-ocre-rouge/30 focus-visible:ring-terracotta text-base"
                      aria-describedby="auth-phone-help"
                    />
                  </div>
                  <p
                    id="auth-phone-help"
                    className="mt-1.5 text-xs text-text-on-light-muted flex items-center gap-1"
                  >
                    <Phone className="size-3" aria-hidden="true" />
                    10 chiffres, préfixe 01 / 05 / 07 (Moov / MTN / Orange).
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => void handleSendOtp()}
                  disabled={isSending || !isValidLocalPhone(phoneInput)}
                  className="w-full bg-terracotta hover:bg-ocre-rouge text-text-on-dark h-11 text-base aya-btn-press"
                >
                  {isSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageCircle className="size-4" />
                  )}
                  Envoyer le code
                </Button>

                {/* Privacy note */}
                <div className="rounded-lg bg-or-poudre-clair/10 border border-or-poudre-clair/30 p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="size-4 text-ocre-rouge shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-text-on-light-muted leading-relaxed">
                      <strong className="text-text-on-light">Ton numéro est hashé (SHA-256)</strong>{" "}
                      et jamais stocké en clair. On garde juste une version masquée pour
                      t'identifier (ex: +225 07 XX XX XX 04).
                    </p>
                  </div>
                </div>

                {/* Rester anonyme */}
                <button
                  type="button"
                  onClick={handleStayAnonymous}
                  className="w-full flex items-center justify-center gap-2 text-sm text-text-on-light-muted hover:text-ocre-rouge transition-colors py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 rounded-md"
                >
                  <UserX className="size-4" aria-hidden="true" />
                  Rester anonyme — je veux juste parler
                </button>
              </motion.div>
            )}

            {/* === STEP 2 : OTP === */}
            {step === "otp" && (
              <motion.div
                key="step-otp"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-xs text-ocre-rouge">
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
                    className="inline-flex items-center gap-1 hover:text-terracotta transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 rounded"
                  >
                    <ArrowLeft className="size-3" />
                    Changer de numéro
                  </button>
                  <span className="text-text-on-light-muted">·</span>
                  <span className="text-text-on-light-muted">
                    Code envoyé à <strong className="text-text-on-light">{maskedPhone}</strong>
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="auth-otp"
                    className="block text-xs font-medium text-ocre-rouge mb-2"
                  >
                    Code à 6 chiffres
                  </label>
                  <InputOTP
                    id="auth-otp"
                    maxLength={6}
                    value={otp}
                    onChange={(v) => setOtp(v)}
                    disabled={isVerifying}
                    containerClassName="justify-center"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={0}
                        className="size-12 sm:size-14 text-xl font-bold first:rounded-l-md last:rounded-r-md border-ocre-rouge/30 data-[active=true]:ring-terracotta/40"
                      />
                      <InputOTPSlot
                        index={1}
                        className="size-12 sm:size-14 text-xl font-bold border-ocre-rouge/30 data-[active=true]:ring-terracotta/40"
                      />
                      <InputOTPSlot
                        index={2}
                        className="size-12 sm:size-14 text-xl font-bold border-ocre-rouge/30 data-[active=true]:ring-terracotta/40"
                      />
                      <InputOTPSlot
                        index={3}
                        className="size-12 sm:size-14 text-xl font-bold border-ocre-rouge/30 data-[active=true]:ring-terracotta/40"
                      />
                      <InputOTPSlot
                        index={4}
                        className="size-12 sm:size-14 text-xl font-bold border-ocre-rouge/30 data-[active=true]:ring-terracotta/40"
                      />
                      <InputOTPSlot
                        index={5}
                        className="size-12 sm:size-14 text-xl font-bold last:rounded-r-md border-ocre-rouge/30 data-[active=true]:ring-terracotta/40"
                      />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="mt-2 text-xs text-text-on-light-muted text-center">
                    Le code expire dans 10 minutes.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => void handleVerify()}
                  disabled={isVerifying || otp.length !== 6}
                  className="w-full bg-terracotta hover:bg-ocre-rouge text-text-on-dark h-11 text-base aya-btn-press"
                >
                  {isVerifying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                  Vérifier et me connecter
                </Button>

                {/* Resend countdown */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => void handleResendOtp()}
                    disabled={resendCountdown > 0 || isSending}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 rounded px-2 py-1",
                      resendCountdown > 0
                        ? "text-text-on-light-muted cursor-not-allowed"
                        : "text-ocre-rouge hover:text-terracotta",
                    )}
                  >
                    {isSending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    {resendCountdown > 0
                      ? `Renvoyer le code dans ${resendCountdown}s`
                      : "Renvoyer le code"}
                  </button>
                </div>

                {/* Rester anonyme (toujours disponible) */}
                <button
                  type="button"
                  onClick={handleStayAnonymous}
                  className="w-full flex items-center justify-center gap-2 text-xs text-text-on-light-muted hover:text-ocre-rouge transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/50 rounded-md"
                >
                  <UserX className="size-3.5" aria-hidden="true" />
                  Rester anonyme
                </button>
              </motion.div>
            )}

            {/* === STEP 3 : SUCCESS === */}
            {step === "success" && (
              <motion.div
                key="step-success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="py-6 text-center space-y-3"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  className="size-16 rounded-full bg-terracotta mx-auto flex items-center justify-center shadow-lg shadow-terracotta/40"
                >
                  <Check className="size-8 text-text-on-dark" strokeWidth={3} />
                </motion.div>
                <p
                  className="text-lg font-bold text-text-on-light"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  Tu es connecté·e 🌿
                </p>
                <p className="text-sm text-text-on-light-muted">
                  Ton carnet peut maintenant être synchronisé entre tes appareils.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;
