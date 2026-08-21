"use client";

/**
 * Sankofa — LoginButton (Task 12)
 *
 * Shows different states depending on NextAuth session:
 *   - Loading      : muted spinner
 *   - Unauthenticated : "Se connecter" button (Phone icon) — opens AuthModal
 *   - Authenticated   : masked phone chip + dropdown menu with "Déconnexion"
 *
 * Two visual variants:
 *   - variant="header" : compact, fits in the WhatsApp-style chat header (light on dark bg)
 *   - variant="footer" : standard, fits in the footer links row
 *
 * Hydration-safe : useSession() returns status="loading" on first render
 * (server-side) — we render a neutral placeholder to avoid hydration mismatch.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { Phone, LogOut, UserCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession, signOut } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

// AuthModal — dynamic import (ssr: false) car useSession + fetch sont navigateur-only
const AuthModal = dynamic(
  () => import("@/components/auth/auth-modal").then((m) => m.AuthModal),
  { ssr: false, loading: () => null },
);

interface LoginButtonProps {
  variant?: "header" | "footer" | "compact";
  className?: string;
}

export function LoginButton({
  variant = "footer",
  className,
}: LoginButtonProps) {
  const { data: session, status } = useSession();
  const [modalOpen, setModalOpen] = React.useState(false);

  const isAuthenticated = status === "authenticated" && !!session?.user;
  const phoneMasked =
    (session?.user as { phoneMasked?: string } | undefined)?.phoneMasked ?? "";
  const subscriptionTier =
    (session?.user as { subscriptionTier?: string | null } | undefined)
      ?.subscriptionTier ?? "free";

  // === Loading state — neutral placeholder to avoid hydration mismatch ===
  if (status === "loading") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-text-on-dark-muted",
          className,
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        <span className="sr-only">Chargement de la session…</span>
      </span>
    );
  }

  // === Authenticated — masked phone chip + dropdown ===
  if (isAuthenticated) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-or-poudre-clair/60",
                variant === "header"
                  ? "bg-or-poudre-clair/15 hover:bg-or-poudre-clair/25 text-text-accent-on-dark border border-or-poudre-clair/30 px-2.5 py-1 text-[11px]"
                  : variant === "compact"
                    ? "bg-or-poudre-clair/15 hover:bg-or-poudre-clair/25 text-text-accent-on-dark border border-or-poudre-clair/30 px-2.5 py-1 text-xs"
                    : "bg-or-poudre-clair/10 hover:bg-or-poudre-clair/20 text-text-on-dark border border-or-poudre-clair/30 px-3 py-1.5 text-sm",
                className,
              )}
              aria-label={`Connecté·e — ${phoneMasked}. Ouvrir le menu compte.`}
            >
              <ShieldCheck
                className={variant === "header" ? "size-3.5" : "size-4"}
                aria-hidden="true"
              />
              <span className="font-mono tracking-tight">{phoneMasked}</span>
              {subscriptionTier && subscriptionTier !== "free" && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-terracotta text-text-on-dark text-[10px] font-bold uppercase">
                  {subscriptionTier === "plan_action"
                    ? "Plan"
                    : subscriptionTier === "teleconsultation"
                      ? "Télé"
                      : subscriptionTier === "family"
                        ? "Famille"
                        : subscriptionTier}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              <div className="flex items-center gap-2">
                <UserCircle className="size-4 text-ocre-rouge" />
                <div className="min-w-0">
                  <div className="text-text-on-light font-semibold truncate">
                    {phoneMasked || "Compte Sankofa"}
                  </div>
                  <div className="text-[10px] text-text-on-light-muted">
                    {subscriptionTier === "free"
                      ? "Compte gratuit"
                      : `Abonnement : ${subscriptionTier}`}
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                signOut({ redirect: false });
                toast.success("Déconnecté·e", {
                  description: "Tu es maintenant en mode anonyme. À bientôt 🌿",
                });
              }}
              className="text-ocre-rouge focus:text-terracotta cursor-pointer"
            >
              <LogOut className="size-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  // === Unauthenticated — "Se connecter" button ===
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setModalOpen(true)}
        className={cn(
          "h-auto p-0 gap-1.5 text-xs font-medium hover:bg-transparent",
          variant === "header"
            ? "text-text-accent-on-dark hover:text-or-poudre-clair"
            : "text-text-on-dark-soft hover:text-text-on-dark",
          className,
        )}
        aria-label="Se connecter avec ton numéro de téléphone (optionnel — tu peux rester anonyme)"
      >
        <Phone
          className={variant === "header" ? "size-3.5" : "size-3.5"}
          aria-hidden="true"
        />
        Se connecter
      </Button>
      <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

export default LoginButton;
