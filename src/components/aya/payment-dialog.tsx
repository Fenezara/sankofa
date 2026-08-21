"use client";

/**
 * Sankofa — Payment Dialog (V2, restylé palette Sankofa)
 *
 * Simulation du flux Mobile Money (Wave + Orange Money + MTN Money).
 * Pas d'intégration bancaire réelle — c'est un mock pour le MVP.
 */

import * as React from "react";
import { Loader2, Smartphone, CheckCircle2, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { KitaBorder } from "@/components/cultural/kita-border";

type Tier = "plan_action" | "teleconsultation";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: Tier | null;
}

const TIER_INFO: Record<Tier, { label: string; amount: number; description: string }> = {
  plan_action: {
    label: "Plan d'action personnalisé",
    amount: 1500,
    description: "Adresses temps réel, check-list TPE, scripts d'accueil, rappels tests",
  },
  teleconsultation: {
    label: "Téléconsultation humaine de garde",
    amount: 3000,
    description: "Visio avec un·e médecin ivoirien·ne sous 24h",
  },
};

type Provider = "wave" | "orange" | "mtn";

const PROVIDERS: { id: Provider; label: string; color: string; textColor: string }[] = [
  { id: "wave", label: "Wave", color: "#1DC8FF", textColor: "#FFFFFF" },
  { id: "orange", label: "Orange Money", color: "#FF6600", textColor: "#FFFFFF" },
  { id: "mtn", label: "MTN Money", color: "#FFCC00", textColor: "#1A0F0A" },
];

function getAnonymousId(): string {
  if (typeof window === "undefined") return uuidv4();
  try {
    let id = window.localStorage.getItem("aya:anonymousId");
    if (!id) {
      id = uuidv4();
      window.localStorage.setItem("aya:anonymousId", id);
    }
    return id;
  } catch {
    return uuidv4();
  }
}

export function PaymentDialog({ open, onOpenChange, tier }: PaymentDialogProps) {
  const [phone, setPhone] = React.useState("");
  const [provider, setProvider] = React.useState<Provider>("wave");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done">("idle");
  const [txnId, setTxnId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStatus("idle");
      setTxnId(null);
      setPhone("");
    }
  }, [open]);

  if (!tier) return null;

  const info = TIER_INFO[tier];

  const handlePay = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      toast.error("Numéro invalide", {
        description: "Entre un numéro Mobile Money valide (8–15 chiffres).",
      });
      return;
    }
    setStatus("loading");
    try {
      const anonymousId = getAnonymousId();
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, phone, anonymousId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur serveur");
      }
      const data = (await res.json()) as {
        transactionId: string;
        amount: number;
        message: string;
      };
      setTxnId(data.transactionId);
      setStatus("done");
      toast.success("Paiement initié", {
        description: `${data.amount} FCFA — réf ${data.transactionId.slice(-8).toUpperCase()}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error("Paiement échoué", { description: msg });
      setStatus("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <KitaBorder thickness={5} />
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-text-on-light">
              <Lock className="size-4 text-terracotta" />
              Paiement Mobile Money
            </DialogTitle>
            <DialogDescription>
              Sankofa — simulation du flux Wave / Orange Money / MTN Money pour le MVP.
              Aucune intégration bancaire réelle.
            </DialogDescription>
          </DialogHeader>

          {status === "idle" && (
            <div className="space-y-4 mt-4">
              {/* Récap */}
              <div className="rounded-lg border border-ocre-rouge/30 p-3 bg-sable-dore/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-on-light-muted">{info.label}</span>
                  <Badge className="bg-terracotta text-text-on-dark border-0">
                    {info.amount.toLocaleString("fr-FR")} FCFA
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-on-light-muted">{info.description}</p>
              </div>

              {/* Provider */}
              <div>
                <Label className="text-xs text-ocre-rouge">Opérateur</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      aria-pressed={provider === p.id}
                      className="h-11 rounded-md text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                      style={{
                        backgroundColor:
                          provider === p.id ? p.color : `${p.color}1A`,
                        color: provider === p.id ? p.textColor : p.color,
                        border: `1px solid ${provider === p.id ? p.color : `${p.color}55`}`,
                      }}
                    >
                      {p.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone" className="text-xs text-ocre-rouge">
                  Numéro Mobile Money
                </Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Smartphone className="size-4 text-text-on-light-muted shrink-0" />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="07 XX XX XX XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="off"
                    className="bg-creme-baobab border-ocre-rouge/30 focus-visible:ring-terracotta"
                  />
                </div>
                <p className="mt-1 text-[10px] text-text-on-light-muted">
                  Seuls les 4 derniers chiffres seront stockés (masqués).
                </p>
              </div>
            </div>
          )}

          {status === "loading" && (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-terracotta" />
              <p className="text-sm text-text-on-light-muted">Initiation du paiement...</p>
            </div>
          )}

          {status === "done" && (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="size-12 text-vert-baobab" />
              <div>
                <p className="font-semibold text-text-on-light">Paiement initié ✅</p>
                <p className="mt-1 text-xs text-text-on-light-muted">
                  Réf : <code className="font-mono">{txnId?.slice(-8).toUpperCase()}</code>
                </p>
              </div>
              <p className="text-xs text-text-on-light-muted max-w-xs">
                Dans une vraie intégration, tu recevrais une notification Mobile Money
                pour confirmer. Le contenu payant serait débloqué automatiquement après
                confirmation.
              </p>
            </div>
          )}

          <DialogFooter className="mt-4">
            {status === "idle" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="border-ocre-rouge/40 text-text-on-light hover:bg-sable-dore/40"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handlePay}
                  className="bg-terracotta hover:bg-ocre-rouge text-text-on-dark gap-2"
                >
                  Payer {info.amount.toLocaleString("fr-FR")} FCFA
                </Button>
              </>
            )}
            {status === "done" && (
              <Button
                onClick={() => onOpenChange(false)}
                className="bg-terracotta hover:bg-ocre-rouge text-text-on-dark gap-2"
              >
                D'accord, merci
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentDialog;
