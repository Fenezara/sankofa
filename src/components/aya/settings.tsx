"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Bell, Lock, Palette, Info, LogOut, ShieldCheck, Trash2, Download, Volume2 } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Settings {
  sounds: boolean;
  notifications: boolean;
  dailyTip: boolean;
  companionMode: boolean;
  strictAnonymous: boolean;
  reducedMotion: boolean;
  largeText: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sounds: true,
  notifications: true,
  dailyTip: true,
  companionMode: true,
  strictAnonymous: false,
  reducedMotion: false,
  largeText: false,
};

const SETTINGS_KEY = "sankofa:settings";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {}
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-terracotta" : "bg-ocre-rouge/20"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-creme-baobab transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ocre-rouge/15 pb-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-ocre-rouge" />
        <h3 className="text-sm font-bold text-terre-brulee">{title}</h3>
      </div>
      <div className="space-y-3 pl-6">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-terre-brulee/80">{label}</span>
      {children}
    </div>
  );
}

export function Settings({ open, onOpenChange }: SettingsProps) {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const { data: session } = useSession();

  React.useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  const update = (key: keyof Settings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const clearChat = () => {
    if (confirm("Effacer tout l'historique de chat ? Cette action est irréversible.")) {
      // Les vraies clés utilisées par chat.tsx
      localStorage.removeItem("aya:chatHistory");
      localStorage.removeItem("aya:historyVersion");
      localStorage.removeItem("aya:persona");
      localStorage.removeItem("aya:anonymousId");
      // Force le rechargement pour réinitialiser le chat
      toast.success("Historique effacé");
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const clearCarnet = () => {
    if (confirm("Effacer le carnet chiffré ? Cette action est irréversible.")) {
      // Le carnet utilise IndexedDB (pas localStorage)
      if (typeof indexedDB !== "undefined") {
        const req = indexedDB.deleteDatabase("aya-carnet");
        req.onsuccess = () => toast.success("Carnet effacé");
        req.onerror = () => toast.error("Erreur lors de l'effacement");
        req.onblocked = () => toast.error("Ferme le carnet avant d'effacer");
      }
      localStorage.removeItem("aya-carnet-pin");
      localStorage.removeItem("aya-carnet-key");
    }
  };

  const exportData = () => {
    const data = {
      chat: localStorage.getItem("aya:chatHistory"),
      streak: localStorage.getItem("sankofa:streak"),
      settings: localStorage.getItem(SETTINGS_KEY),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sankofa-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Données exportées");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-terre-brulee/60 backdrop-blur-sm p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-creme-baobab rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6 border border-ocre-rouge/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-terre-brulee" style={{ fontFamily: "var(--font-bricolage)" }}>
                Paramètres
              </h2>
              <button onClick={() => onOpenChange(false)} className="p-2 rounded-full hover:bg-ocre-rouge/10" aria-label="Fermer">
                <X className="size-5 text-terre-brulee/60" />
              </button>
            </div>

            {session?.user && (
              <Section icon={User} title="Compte">
                <Row label="Téléphone">
                  <span className="text-sm text-terre-brulee/60">{(session.user as { phoneMasked?: string }).phoneMasked || "—"}</span>
                </Row>
                <Row label="Abonnement">
                  <span className="text-sm text-terre-brulee/60">Gratuit</span>
                </Row>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 text-sm text-rose-couchee hover:underline"
                >
                  <LogOut className="size-4" /> Se déconnecter
                </button>
              </Section>
            )}

            <Section icon={Volume2} title="Sons">
              <Row label="Sons d'envoi et réception">
                <Toggle checked={settings.sounds} onChange={() => update("sounds", !settings.sounds)} />
              </Row>
            </Section>

            <Section icon={Bell} title="Notifications">
              <Row label="Rappels tests VIH">
                <Toggle checked={settings.notifications} onChange={() => update("notifications", !settings.notifications)} />
              </Row>
              <Row label="Astuce du jour">
                <Toggle checked={settings.dailyTip} onChange={() => update("dailyTip", !settings.dailyTip)} />
              </Row>
              <Row label="Mode compagnon">
                <Toggle checked={settings.companionMode} onChange={() => update("companionMode", !settings.companionMode)} />
              </Row>
            </Section>

            <Section icon={Lock} title="Confidentialité">
              <Row label="Mode anonyme strict">
                <Toggle checked={settings.strictAnonymous} onChange={() => update("strictAnonymous", !settings.strictAnonymous)} />
              </Row>
              <button onClick={clearChat} className="flex items-center gap-2 text-sm text-rose-couchee hover:underline">
                <Trash2 className="size-4" /> Effacer l'historique de chat
              </button>
              <button onClick={clearCarnet} className="flex items-center gap-2 text-sm text-rose-couchee hover:underline">
                <Trash2 className="size-4" /> Effacer le carnet chiffré
              </button>
              <button onClick={exportData} className="flex items-center gap-2 text-sm text-ocre-rouge hover:underline">
                <Download className="size-4" /> Exporter mes données
              </button>
            </Section>

            <Section icon={Palette} title="Apparence">
              <Row label="Animations réduites">
                <Toggle checked={settings.reducedMotion} onChange={() => update("reducedMotion", !settings.reducedMotion)} />
              </Row>
              <Row label="Texte agrandi">
                <Toggle checked={settings.largeText} onChange={() => update("largeText", !settings.largeText)} />
              </Row>
            </Section>

            <Section icon={Info} title="À propos">
              <Row label="Version">
                <span className="text-sm text-terre-brulee/60">Sankofa v1.0.0</span>
              </Row>
              <div className="flex items-center gap-2 text-xs text-terre-brulee/50">
                <ShieldCheck className="size-3" />
                Conforme Décret 2018-361 · ARTCI · AIBEF · CNOMCI
              </div>
              <div className="text-xs text-terre-brulee/50">Contact : contact@sankofa.ci</div>
            </Section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Settings;
