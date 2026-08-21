"use client";

/**
 * Sankofa — Page principale (single-route app shell with 5 tabs)
 *
 * Layout responsive :
 *   - Mobile (< md / 768px) : header top + content + bottom-nav (auto-hide Instagram)
 *   - Desktop (≥ md)        : sidebar gauche fixe (rail vertical) + content plein écran
 *
 * Effets maintenus :
 *   - WhatsApp : chat full-height, messages scrollables, input fixé en bas
 *   - Instagram : bottom-nav auto-hide sur scroll down, reappear sur scroll up (mobile only)
 *
 * Root wrapper : h-[100dvh] flex (mobile flex-col, desktop flex-row).
 */

import * as React from "react";
import dynamic from "next/dynamic";

import { Chat, type ChatMessage } from "@/components/aya/chat";
import { TpeSection } from "@/components/aya/tpe-section";
import { PaymentDialog } from "@/components/aya/payment-dialog";
import { PrivacyDialog } from "@/components/aya/privacy-dialog";
import { CarnetSection } from "@/components/aya/carnet-section";
import {
  Settings as SettingsIcon,
  MessageCircle,
  Sprout,
  Clock,
  BookLock,
  Info,
  Flame,
} from "lucide-react";
import { OnboardingGuard } from "@/components/aya/onboarding";
import { Settings } from "@/components/aya/settings";
import { SankofaLogo } from "@/components/aya/sankofa-logo";
import { updateStreak } from "@/lib/streaks";
import { CoachTab } from "@/components/aya/coach-tab";
import { AideTab } from "@/components/aya/aide-tab";
import type { CarnetEntryData, CarnetEntryType } from "@/lib/carnet/service";

// Carnet — dynamic import (ssr: false) car IndexedDB + Web Crypto sont navigateur-only
const Carnet = dynamic(
  () => import("@/components/aya/carnet").then((m) => m.Carnet),
  { ssr: false, loading: () => null },
);

// Admin dashboard — dynamic import (ssr: false)
const AdminDashboard = dynamic(
  () => import("@/components/aya/admin-dashboard").then((m) => m.AdminDashboard),
  { ssr: false, loading: () => null },
);

export type SankofaTab = "parler" | "coach" | "tpe" | "carnet" | "aide";

const ACTIVE_TAB_KEY = "sankofa:activeTab";
const VALID_TABS: SankofaTab[] = ["parler", "coach", "tpe", "carnet", "aide"];

const TABS = [
  { id: "parler", label: "Parler", icon: MessageCircle },
  { id: "coach", label: "Conseils", icon: Sprout },
  { id: "tpe", label: "SOS 72h", icon: Clock },
  { id: "carnet", label: "Carnet", icon: BookLock },
  { id: "aide", label: "Aide", icon: Info },
] as const;

export default function HomePage() {
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [paymentTier, setPaymentTier] = React.useState<"plan_action" | "teleconsultation" | null>(null);
  const [charteOpen, setCharteOpen] = React.useState(false);
  const [carnetOpen, setCarnetOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [streak, setStreak] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<SankofaTab>("parler");
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(null);
  const [carnetPrefill, setCarnetPrefill] = React.useState<{ type: CarnetEntryType; data: CarnetEntryData } | null>(null);
  const [navVisible, setNavVisible] = React.useState(true);
  const lastScrollY = React.useRef(0);
  const navLockRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  // Ignore les scrolls programmatiques (scrollIntoView du chat au mount)
  const userInteractedRef = React.useRef(false);

  // Active l'auto-hide seulement après une vraie interaction utilisateur (touch/wheel)
  React.useEffect(() => {
    const activate = () => { userInteractedRef.current = true; };
    window.addEventListener("touchstart", activate, { passive: true, once: true });
    window.addEventListener("wheel", activate, { passive: true, once: true });
    window.addEventListener("keydown", activate, { passive: true, once: true });
    return () => {
      window.removeEventListener("touchstart", activate);
      window.removeEventListener("wheel", activate);
      window.removeEventListener("keydown", activate);
    };
  }, []);

  // Auto-hide nav — technique Instagram/YouTube (mobile only, desktop sidebar always visible)
  const handleNavScroll = React.useCallback((e: React.UIEvent<HTMLElement> | Event) => {
    // Ignore les scrolls programmatiques (scrollIntoView au mount, auto-scroll du chat)
    if (!userInteractedRef.current) return;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const target = (e as React.UIEvent<HTMLElement>).currentTarget || (e as Event).target as HTMLElement;
      if (!target) return;
      const currentScrollY = target.scrollTop;
      const maxScroll = target.scrollHeight - target.clientHeight;
      const distanceFromBottom = maxScroll - currentScrollY;

      // Zone morte : ne pas toggle en bas ou en haut
      if (distanceFromBottom < 50) { lastScrollY.current = currentScrollY; return; }
      if (currentScrollY < 30) { setNavVisible(true); lastScrollY.current = currentScrollY; return; }

      // Lock anti-feedback
      if (navLockRef.current) { lastScrollY.current = currentScrollY; return; }

      const delta = currentScrollY - lastScrollY.current;
      if (delta > 20 && navVisible) {
        setNavVisible(false);
        navLockRef.current = true;
        setTimeout(() => { navLockRef.current = false; }, 400);
      } else if (delta < -20 && !navVisible) {
        setNavVisible(true);
        navLockRef.current = true;
        setTimeout(() => { navLockRef.current = false; }, 400);
      }
      lastScrollY.current = currentScrollY;
    });
  }, [navVisible]);

  React.useEffect(() => {
    setStreak(updateStreak().current);
    setActiveTab("parler");
    setNavVisible(true); // Ensure nav visible on mount

    // Empêcher le zoom (pinch) sur mobile — iOS Safari ignore user-scalable=no
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("touchmove", preventZoom, { passive: false });
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);

    return () => {
      document.removeEventListener("touchmove", preventZoom);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  const handleTabChange = (tab: SankofaTab) => {
    setActiveTab(tab);
    setNavVisible(true);
    lastScrollY.current = 0;
    try { localStorage.setItem(ACTIVE_TAB_KEY, tab); } catch {}
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  };

  const handleAskQuestion = (question: string) => {
    setPendingQuestion(question);
    setActiveTab("parler");
    try { localStorage.setItem(ACTIVE_TAB_KEY, "parler"); } catch {}
  };

  const handlePendingQuestionConsumed = React.useCallback(() => {
    setPendingQuestion(null);
  }, []);

  const handlePay = (tier: "plan_action" | "teleconsultation") => {
    setPaymentTier(tier);
    setPaymentOpen(true);
  };

  const handleActivatePlan = () => handlePay("plan_action");

  const handleOpenCarnet = () => setCarnetOpen(true);

  const handleSaveToCarnet = (msg: ChatMessage) => {
    const prefill: { type: CarnetEntryType; data: CarnetEntryData } = {
      type: "consultation",
      data: {
        date: new Date().toISOString().slice(0, 10),
        resume: msg.content,
        persona: msg.persona === "grande_soeur" ? "Aya" : msg.persona === "grand_frere" ? "Yao" : msg.persona === "tonton_medecin" ? "Tonton Koffi" : undefined,
      },
    };
    setCarnetPrefill(prefill);
    setCarnetOpen(true);
  };

  // Wrapper scrollable avec auto-hide nav + overflow-x-hidden (anti-décalage horizontal).
  // `tab-content-enter` applique une transition fade + slide-up à chaque switch d'onglet
  // (animation CSS-only, recalcitrante à chaque mount via key activeTab).
  const scrollableProps = {
    onScroll: handleNavScroll,
    className: "tab-content-enter flex-1 min-h-0 overflow-y-auto overflow-x-hidden aya-scroll",
  };

  return (
    <OnboardingGuard>
      <div className="h-[100dvh] flex flex-col lg:flex-row bg-warm-aura text-terre-brulee overflow-hidden">

        {/* === DESKTOP : Sidebar gauche fixe (≥ md) === */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 lg:border-r lg:border-ocre-rouge/15 lg:bg-creme-baobab lg:z-30">
          {/* Subtle Adinkra pattern texture (3% opacity) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "url('/images/v3/pattern-adinkra.jpg')",
              backgroundSize: "240px 240px",
              backgroundRepeat: "repeat",
              opacity: 0.03,
              mixBlendMode: "multiply",
            }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col h-full">
            {/* Logo + nom */}
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-ocre-rouge/10">
              <SankofaLogo size={36} animated withText={false} />
              <div className="flex flex-col">
                <span
                  className="font-bold text-terre-brulee text-lg leading-none"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  Sankofa
                </span>
                <span className="text-[10px] text-ocre-rouge/60 mt-0.5">Ton aîné·e santé</span>
              </div>
            </div>

            {/* Nav verticale */}
            <nav className="flex-1 flex flex-col gap-1 px-3 py-4" aria-label="Navigation principale">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
                      isActive
                        ? "bg-terracotta/12 text-terracotta"
                        : "text-ocre-rouge/60 hover:text-ocre-rouge hover:bg-ocre-rouge/5"
                    }`}
                    aria-label={tab.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-semibold">{tab.label}</span>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-terracotta"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Streak + Settings en bas */}
            <div className="px-3 py-3 border-t border-ocre-rouge/10 flex items-center justify-between gap-2">
              {streak > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #F4C77B 0%, #E89B3C 100%)",
                    borderColor: "rgba(123, 70, 19, 0.4)",
                    boxShadow: "0 2px 8px rgba(232, 155, 60, 0.35)",
                  }}
                  aria-label={`Série de ${streak} jours`}
                >
                  <Flame className="size-3.5 text-ocre-rouge" />
                  <span className="text-xs font-bold text-ocre-rouge leading-none">{streak}j</span>
                </div>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="size-9 rounded-full flex items-center justify-center text-ocre-rouge hover:bg-ocre-rouge/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                aria-label="Paramètres"
              >
                <SettingsIcon className="size-4.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* === MOBILE : Header compact (< md) === */}
        <header className="lg:hidden relative shrink-0 border-b border-ocre-rouge/15 z-30 bg-creme-baobab">
          {/* Subtle Adinkra pattern texture (3% opacity) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "url('/images/v3/pattern-adinkra.jpg')",
              backgroundSize: "240px 240px",
              backgroundRepeat: "repeat",
              opacity: 0.03,
              mixBlendMode: "multiply",
            }}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SankofaLogo size={32} animated withText={false} />
              <span
                className="font-bold text-terre-brulee text-base"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                Sankofa
              </span>
            </div>
            <div className="flex items-center gap-2">
              {streak > 0 && (
                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #F4C77B 0%, #E89B3C 100%)",
                    borderColor: "rgba(123, 70, 19, 0.4)",
                    boxShadow: "0 2px 8px rgba(232, 155, 60, 0.35)",
                  }}
                  aria-label={`Série de ${streak} jours`}
                >
                  <Flame className="size-3 text-ocre-rouge" />
                  <span className="text-[10px] font-bold text-ocre-rouge leading-none">{streak}j</span>
                </div>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="size-8 rounded-full flex items-center justify-center text-ocre-rouge hover:bg-ocre-rouge/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                aria-label="Paramètres"
              >
                <SettingsIcon className="size-4" />
              </button>
            </div>
          </div>
        </header>

        {/* === Tab content — fills remaining space === */}
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* Tab 1: Parler (Chat) — WhatsApp style, full height */}
          <div
            hidden={activeTab !== "parler"}
            className="flex-1 min-h-0 flex flex-col"
          >
            <Chat
              onSaveToCarnet={handleSaveToCarnet}
              pendingQuestion={pendingQuestion}
              onPendingQuestionConsumed={handlePendingQuestionConsumed}
              onScrollNavToggle={handleNavScroll}
            />
          </div>

          {/* Tab 2: Conseils */}
          {activeTab === "coach" && (
            <div {...scrollableProps}>
              <CoachTab onAskQuestion={handleAskQuestion} />
            </div>
          )}

          {/* Tab 3: SOS 72h */}
          {activeTab === "tpe" && (
            <div className="tab-content-enter flex-1 min-h-0 overflow-y-auto overflow-x-hidden aya-scroll">
              <TpeSection onActivatePlan={handleActivatePlan} />
            </div>
          )}

          {/* Tab 4: Carnet */}
          {activeTab === "carnet" && (
            <div {...scrollableProps}>
              <CarnetSection onOpenCarnet={handleOpenCarnet} />
            </div>
          )}

          {/* Tab 5: Aide */}
          {activeTab === "aide" && (
            <div {...scrollableProps}>
              <AideTab onOpenCgu={() => setCharteOpen(true)} onPay={handlePay} />
            </div>
          )}
        </main>

        {/* === MOBILE : Bottom navigation — auto-hide like Instagram/YouTube === */}
        <nav
          className="lg:hidden relative shrink-0 border-t border-ocre-rouge/15 z-30 bg-creme-baobab nav-transition"
          style={{
            height: 60,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            transform: navVisible ? "translateY(0)" : "translateY(100%)",
            opacity: navVisible ? 1 : 0,
          }}
          aria-label="Navigation principale"
          aria-hidden={!navVisible}
        >
          {/* Subtle Adinkra pattern texture (3% opacity) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "url('/images/v3/pattern-adinkra.jpg')",
              backgroundSize: "200px 200px",
              backgroundRepeat: "repeat",
              opacity: 0.03,
              mixBlendMode: "multiply",
            }}
            aria-hidden="true"
          />
          <div className="relative grid grid-cols-5 gap-0 max-w-md mx-auto h-full">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none ${
                    isActive
                      ? "text-terracotta"
                      : "text-ocre-rouge/40 hover:text-ocre-rouge/70"
                  }`}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-1 size-1.5 rounded-full bg-terracotta"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Modals */}
        <Carnet
          open={carnetOpen}
          onOpenChange={setCarnetOpen}
          prefill={carnetPrefill}
          onPrefillConsumed={() => setCarnetPrefill(null)}
        />
        <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} tier={paymentTier} />
        <PrivacyDialog open={charteOpen} onOpenChange={setCharteOpen} />
        <AdminDashboard />
        <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </OnboardingGuard>
  );
}
