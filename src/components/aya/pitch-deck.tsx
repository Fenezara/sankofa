"use client";

/**
 * Sankofa — Pitch Deck investisseurs (modal, 10 slides)
 *
 * Accessible via un bouton discret dans le footer ("Pitch deck").
 * Navigation : flèches clavier (← →), boutons flèches, points (dots), Esc ferme.
 *
 * Design : chaque slide est une carte au gradient chaud (terre-brulee → ocre-rouge),
 * texte large, branding Sankofa (logo Adinkra + tagline).
 *
 * Contenu basé sur l'analyse concurrentielle du worklog (10 slides :
 * titre, problème, solution, marché, concurrence, produit, business model,
 * traction, équipe, ask).
 *
 * Le composant expose aussi un trigger programmable via la prop `open` + `onOpenChange`,
 * ce qui permet au footer de le piloter.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  HeartPulse,
  Layers,
  Coins,
  Rocket,
  Users,
  HandCoins,
  Check,
  Minus,
  X as XIcon,
} from "lucide-react";
import { SankofaLogo } from "@/components/aya/sankofa-logo";

interface PitchDeckProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---- Slide type ----
type SlideKind =
  | "title"
  | "problem"
  | "solution"
  | "market"
  | "competition"
  | "product"
  | "business"
  | "traction"
  | "team"
  | "ask";

interface Slide {
  kind: SlideKind;
  num: number;
}

const SLIDES: Slide[] = [
  { kind: "title", num: 1 },
  { kind: "problem", num: 2 },
  { kind: "solution", num: 3 },
  { kind: "market", num: 4 },
  { kind: "competition", num: 5 },
  { kind: "product", num: 6 },
  { kind: "business", num: 7 },
  { kind: "traction", num: 8 },
  { kind: "team", num: 9 },
  { kind: "ask", num: 10 },
];

const SLIDE_LABELS: Record<SlideKind, string> = {
  title: "Titre",
  problem: "Problème",
  solution: "Solution",
  market: "Marché",
  competition: "Concurrence",
  product: "Produit",
  business: "Business model",
  traction: "Traction",
  team: "Équipe",
  ask: "Ask",
};

// ---- Données concurrents (slide 5) ----
const COMPETITOR_CRITERIA = [
  "Cible 15-19 ans",
  "TPE 72h",
  "Anonymat radical",
  "Ton Nouchi",
  "2 langues écrites (FR + Nouchi) + audio bientôt",
  "Mode compagnon",
  "Carnet chiffré local",
  "Pricing hybride (gratuit → 3000 F)",
  "Partenariat AIBEF",
] as const;

type CompetitorCell = "yes" | "no" | "partial";

const COMPETITORS: Array<{
  name: string;
  origin: string;
  cells: CompetitorCell[];
  highlight?: boolean;
}> = [
  {
    name: "La Ruche Health",
    origin: "🇨🇮 CI",
    cells: ["no", "no", "partial", "no", "no", "no", "no", "partial", "yes"],
  },
  {
    name: "Waspito",
    origin: "🇨🇲🇨🇮",
    cells: ["no", "no", "no", "no", "no", "no", "no", "yes", "no"],
  },
  {
    name: "Aimee",
    origin: "🌍 SA",
    cells: ["partial", "no", "partial", "no", "no", "no", "no", "partial", "no"],
  },
  {
    name: "Aya",
    origin: "🇨🇮 CI",
    cells: ["yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes", "yes"],
    highlight: true,
  },
];

function CellIcon({ value }: { value: CompetitorCell }) {
  if (value === "yes") {
    return <Check className="size-4 text-emerald-300" aria-label="oui" />;
  }
  if (value === "partial") {
    return <Minus className="size-4 text-or-poudre-clair" aria-label="partiel" />;
  }
  return <XIcon className="size-4 text-red-300/70" aria-label="non" />;
}

// ---- Sub-components per slide ----

function SlideHeader({ num, label }: { num: number; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-or-poudre-clair/80">
        {String(num).padStart(2, "0")} / 10
      </span>
      <span className="h-px flex-1 bg-or-poudre-clair/30" aria-hidden="true" />
      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-or-poudre-clair/80">
        {label}
      </span>
    </div>
  );
}

function SlideTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-3xl sm:text-4xl md:text-5xl font-black text-text-on-dark leading-tight"
      style={{ fontFamily: "var(--font-bricolage)" }}
    >
      {children}
    </h2>
  );
}

function SlideBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 text-base sm:text-lg text-text-on-dark-soft leading-relaxed space-y-3">
      {children}
    </div>
  );
}

function Bullet({ children, accent = "#F4C77B" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-1.5 size-2 rounded-full shrink-0"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      />
      <span className="flex-1">{children}</span>
    </div>
  );
}

// ---- Slides ----

function SlideTitle1() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full py-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <SankofaLogo size={72} />
      </motion.div>
      <SlideTitle>
        Sankofa — Ton aîné·e santé.
        <br />
        <span className="text-or-poudre-clair">Façonnée en Côte d'Ivoire.</span>
      </SlideTitle>
      <p
        className="mt-5 text-xl sm:text-2xl text-text-on-dark-soft"
        style={{ fontFamily: "var(--font-caveat)", fontWeight: 600 }}
      >
        « Ton grand frère santé, 100% anonyme, 24/7, en Nouchi. »
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {["SSR", "Addictologie", "Dermato", "Santé mentale", "Nutrition"].map((d) => (
          <span
            key={d}
            className="px-2.5 py-1 rounded-full text-xs font-medium bg-or-poudre-clair/15 text-or-poudre-clair border border-or-poudre-clair/30"
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

function SlideProblem() {
  const stats = [
    { value: "90%", label: "des conseils d'influenceurs sont faux" },
    { value: "<100", label: "psychologues pour 28M habitants" },
    { value: "30%", label: "de la population touche au tramadol" },
    { value: "15-19", label: "ans : la tranche la plus exposée, la moins servie" },
  ];
  return (
    <div>
      <SlideHeader num={2} label="Problème" />
      <SlideTitle>
        Les jeunes ivoiriens
        <br />
        n'ont pas accès à l'info santé.
      </SlideTitle>
      <SlideBody>
        <p>
          La santé sexuelle, mentale et addictologique reste taboue. Les jeunes
          se tournent vers TikTok, les influenceurs, les pharmacies de rue.
          Conséquence : désinformation massive, urgences mal gérées, stigmatisation.
        </p>
      </SlideBody>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4"
          >
            <div
              className="text-3xl font-black text-or-poudre-clair"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {s.value}
            </div>
            <div className="text-xs text-text-on-dark-soft mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideSolution() {
  return (
    <div>
      <SlideHeader num={3} label="Solution" />
      <SlideTitle>
        Sankofa — le seul coach santé IA
        <br />
        <span className="text-or-poudre-clair">validé par des médecins ivoiriens.</span>
      </SlideTitle>
      <SlideBody>
        <p>
          Une assistante IA conversationnelle (WhatsApp-style), anonyme, 24/7,
          qui parle Nouchi (et bientôt Dioula et Baoulé en audio). Spécialisée sur 5 domaines santé
          critiques pour les 15-19 ans.
        </p>
      </SlideBody>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4">
          <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80 mb-2">
            5 domaines santé
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["SSR", "Addictologie", "Dermatologie", "Santé mentale", "Nutrition"].map((d) => (
              <span
                key={d}
                className="px-2 py-0.5 rounded text-xs bg-terracotta/30 text-text-on-dark border border-terracotta/40"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4">
          <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80 mb-2">
            2 langues écrites + audio bientôt
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Français", "Nouchi"].map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 rounded text-xs bg-vert-baobab/30 text-emerald-200 border border-vert-baobab/40"
              >
                {l}
              </span>
            ))}
            {["Dioula", "Baoulé"].map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 rounded text-xs bg-vert-baobab/15 text-emerald-200/70 border border-vert-baobab/30 italic"
              >
                {l} · audio
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideMarket() {
  return (
    <div>
      <SlideHeader num={4} label="Marché" />
      <SlideTitle>
        Un marché de 28M personnes,
        <br />
        <span className="text-or-poudre-clair">6M jeunes à servir.</span>
      </SlideTitle>
      <SlideBody>
        <Bullet>
          <strong className="text-text-on-dark">28M Ivoiriens</strong>, dont{" "}
          <strong className="text-text-on-dark">6M jeunes 15-24 ans</strong> —
          la tranche la plus exposée aux risques SSR/addiction.
        </Bullet>
        <Bullet>
          <strong className="text-text-on-dark">Télémédecine CI en croissance 42%/an</strong> —
          adoption accélérée post-COVID, mobile-first.
        </Bullet>
        <Bullet>
          <strong className="text-text-on-dark">Mobile money : 80% de pénétration</strong> —
          Wave, Orange Money, MTN. Monétisation native, sans friction.
        </Bullet>
        <Bullet>
          <strong className="text-text-on-dark">Diaspora ivoirienne</strong> : ~3M personnes
          en France, Italie, USA — demande forte de paiement santé pour la famille restée au pays.
        </Bullet>
      </SlideBody>
    </div>
  );
}

function SlideCompetition() {
  return (
    <div>
      <SlideHeader num={5} label="Concurrence" />
      <SlideTitle>
        Sankofa vs les autres.
        <br />
        <span className="text-or-poudre-clair">9 critères, zéro compromis.</span>
      </SlideTitle>
      <div className="mt-5 overflow-x-auto aya-admin-scroll">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-text-on-dark-muted px-2 py-2 sticky left-0 bg-terre-brulee">
                Critère
              </th>
              {COMPETITORS.map((c) => (
                <th
                  key={c.name}
                  className={`px-2 py-2 text-center font-bold ${
                    c.highlight
                      ? "text-or-poudre-clair bg-or-poudre-clair/15 rounded-t-lg"
                      : "text-text-on-dark-soft"
                  }`}
                >
                  <div>{c.name}</div>
                  <div className="text-[10px] font-normal text-text-on-dark-muted">{c.origin}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPETITOR_CRITERIA.map((crit, i) => (
              <tr key={crit} className="border-t border-or-poudre-clair/10">
                <td className="text-left text-text-on-dark-soft px-2 py-2 sticky left-0 bg-terre-brulee">
                  {crit}
                </td>
                {COMPETITORS.map((c) => (
                  <td
                    key={c.name}
                    className={`text-center px-2 py-2 ${
                      c.highlight ? "bg-or-poudre-clair/10" : ""
                    }`}
                  >
                    <span className="inline-flex justify-center">
                      <CellIcon value={c.cells[i]} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-on-dark-muted">
        Sankofa est le seul acteur à cumuler anonymat radical, TPE 72h, mode compagnon
        et 2 langues écrites (FR + Nouchi) — Dioula/Baoulé en audio bientôt — sur le marché ivoirien.
      </p>
    </div>
  );
}

function SlideProduct() {
  const features = [
    { icon: HeartPulse, title: "Chat IA", desc: "3 personas (grande sœur, grand frère, tonton médecin)" },
    { icon: Sparkles, title: "Mode compagnon", desc: "Suivi de trajet vers la structure de santé, unique au monde" },
    { icon: Layers, title: "Carnet chiffré", desc: "AES-256, 100% local, aucune donnée ne quitte le téléphone" },
    { icon: AlertTriangle, title: "TPE 72h", desc: "Détection automatique + chrono 3D + protocole OMS" },
    { icon: Rocket, title: "PWA offline", desc: "Protocoles en cache, chat fallback, installable" },
    { icon: Coins, title: "Mobile Money", desc: "Wave / Orange / MTN — 1500 F (plan) → 3000 F (téléconsult)" },
  ];
  return (
    <div>
      <SlideHeader num={6} label="Produit" />
      <SlideTitle>
        Un MVP complet.
        <br />
        <span className="text-or-poudre-clair">Pas une démo. Un produit.</span>
      </SlideTitle>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-3"
            >
              <span className="size-8 rounded-lg flex items-center justify-center bg-or-poudre-clair/15 text-or-poudre-clair mb-2">
                <Icon className="size-4" />
              </span>
              <div className="text-sm font-bold text-text-on-dark">{f.title}</div>
              <div className="text-[11px] text-text-on-dark-soft mt-0.5">{f.desc}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-text-on-dark-muted">
        Stack : Next.js 16 · Prisma (SQLite) · z-ai-web-dev-sdk · Framer Motion · PWA · 8 red flags · 9 protocoles RAG.
      </p>
    </div>
  );
}

function SlideBusiness() {
  const tiers = [
    {
      name: "Gratuit",
      price: "0 FCFA",
      desc: "Triage + info + orientation",
      tag: "Acquisition",
      color: "#3D5C3D",
    },
    {
      name: "Plan d'action",
      price: "1 500 FCFA",
      desc: "Adresses temps réel, check-list TPE, scripts, rappels",
      tag: "Conversion",
      color: "#9B3F1F",
    },
    {
      name: "Téléconsultation",
      price: "3 000 FCFA",
      desc: "Visio avec médecin ivoirien sous 24h",
      tag: "Premium",
      color: "#7B4B5C",
    },
  ];
  return (
    <div>
      <SlideHeader num={7} label="Business model" />
      <SlideTitle>
        Freemium santé,
        <br />
        <span className="text-or-poudre-clair">monétisation native Mobile Money.</span>
      </SlideTitle>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4"
            style={{ borderTop: `3px solid ${t.color}` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-text-on-dark">{t.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-text-on-dark"
                style={{ backgroundColor: t.color }}
              >
                {t.tag}
              </span>
            </div>
            <div
              className="text-xl font-black text-or-poudre-clair"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {t.price}
            </div>
            <div className="text-xs text-text-on-dark-soft mt-1">{t.desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-3">
          <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80 mb-1">
            Pack Diaspora
          </div>
          <div className="text-sm text-text-on-dark">
            <strong className="text-or-poudre-clair">50€/an</strong> — un proche au pays
            couvert (plan action + 2 téléconsults/an).
          </div>
        </div>
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-3">
          <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80 mb-1">
            B2B Cliniques
          </div>
          <div className="text-sm text-text-on-dark">
            <strong className="text-or-poudre-clair">White-label</strong> — Sankofa triage en
            marque blanche pour cliniques privées (10-30k FCFA/mois/clinique).
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideTraction() {
  const traction = [
    { value: "1", label: "MVP fonctionnel en production" },
    { value: "14", label: "images photoréalistes (personas, scènes CI)" },
    { value: "5", label: "modules santé complets" },
    { value: "2", label: "langues écrites (FR + Nouchi) — Dioula/Baoulé en audio bientôt" },
    { value: "8", label: "red flags + réponses pré-écrites sécurisées" },
    { value: "9", label: "protocoles RAG validés" },
    { value: "1", label: "mode compagnon unique au monde" },
    { value: "0", label: "donnée patient stockée (privacy by design)" },
  ];
  return (
    <div>
      <SlideHeader num={8} label="Traction" />
      <SlideTitle>
        Ce qui existe déjà.
        <br />
        <span className="text-or-poudre-clair">Pas un pitch. Un produit live.</span>
      </SlideTitle>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {traction.map((t) => (
          <div
            key={t.label}
            className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-3 text-center"
          >
            <div
              className="text-3xl font-black text-or-poudre-clair"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {t.value}
            </div>
            <div className="text-[11px] text-text-on-dark-soft mt-1 leading-snug">
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideTeam() {
  return (
    <div>
      <SlideHeader num={9} label="Équipe" />
      <SlideTitle>
        Une équipe à compléter.
        <br />
        <span className="text-or-poudre-clair">Un comité médical à constituer.</span>
      </SlideTitle>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-4 text-or-poudre-clair" />
            <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80">
              Fondateur
            </div>
          </div>
          <div className="text-sm text-text-on-dark-soft">
            À compléter — profil product/engineer avec expérience santé Afrique francophone.
            Recherche co-fondateur CTO (IA + infra WhatsApp).
          </div>
        </div>
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse className="size-4 text-or-poudre-clair" />
            <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80">
              Comité médical conseiller
            </div>
          </div>
          <div className="text-sm text-text-on-dark-soft">
            Placeholders à confirmer : gynéco AIBEF, médecin addictologue CHU Cocody,
            psychiatre 143, dermatologue Institut Pasteur CI.
          </div>
        </div>
        <div className="rounded-xl bg-noir-encre/30 border border-or-poudre-clair/15 p-4 sm:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="size-4 text-or-poudre-clair" />
            <div className="text-xs uppercase tracking-wider text-or-poudre-clair/80">
              Partenariats visés
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "AIBEF (moat institutionnel)",
              "OMS CI",
              "Ministère Santé",
              "ARTCI (certif)",
              "Wave Business",
              "Orange CI",
            ].map((p) => (
              <span
                key={p}
                className="px-2 py-0.5 rounded text-xs bg-or-poudre-clair/15 text-or-poudre-clair border border-or-poudre-clair/30"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideAsk() {
  return (
    <div>
      <SlideHeader num={10} label="Ask" />
      <SlideTitle>
        Levée seed
        <br />
        <span className="text-or-poudre-clair">150 000€</span>
      </SlideTitle>
      <SlideBody>
        <p>Pour passer du MVP au pilote terrain à Abidjan :</p>
      </SlideBody>
      <div className="mt-4 space-y-2">
        {[
          { num: "1", label: "Intégration WhatsApp réelle (BSP officiel Meta)", cost: "~40k€" },
          { num: "2", label: "Partenariat AIBEF signé + audit médical 3 mois", cost: "~25k€" },
          { num: "3", label: "1000 utilisateurs pilotes Abidjan (Yopougon, Cocody, Abobo)", cost: "~50k€" },
          { num: "4", label: "Certification ARTCI + conformité Décret 2018-361", cost: "~15k€" },
          { num: "5", label: "Runway 12 mois (équipe minimale : 3)", cost: "~20k€" },
        ].map((item) => (
          <div
            key={item.num}
            className="flex items-center gap-3 rounded-lg bg-noir-encre/30 border border-or-poudre-clair/15 p-3"
          >
            <span
              className="size-7 shrink-0 rounded-full bg-or-poudre-clair/20 text-or-poudre-clair flex items-center justify-center font-bold text-sm"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              {item.num}
            </span>
            <span className="flex-1 text-sm text-text-on-dark-soft">{item.label}</span>
            <span className="text-xs font-semibold text-or-poudre-clair">{item.cost}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl bg-terracotta/20 border border-terracotta/40 p-4 text-center">
        <HandCoins className="size-6 text-or-poudre-clair mx-auto mb-2" />
        <div className="text-sm font-bold text-text-on-dark">Contact</div>
        <a
          href="mailto:contact@aya.ci"
          className="text-or-poudre-clair underline underline-offset-2 hover:text-text-on-dark transition-colors"
        >
          contact@aya.ci
        </a>
      </div>
    </div>
  );
}

// ---- Main component ----

export function PitchDeck({ open, onOpenChange }: PitchDeckProps) {
  const [index, setIndex] = React.useState(0);

  // Reset to first slide on open
  React.useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const goNext = React.useCallback(() => {
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }, []);
  const goPrev = React.useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard nav
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex(SLIDES.length - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goPrev, onOpenChange]);

  const current = SLIDES[index];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Pitch deck Sankofa — présentation investisseurs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-noir-encre/90 backdrop-blur-md"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at top right, rgba(244, 199, 123, 0.10) 0%, transparent 40%), radial-gradient(ellipse at bottom left, rgba(155, 63, 31, 0.15) 0%, transparent 50%)",
            }}
            aria-hidden="true"
          />

          <button
            type="button"
            aria-label="Fermer le pitch deck"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 z-10 inline-flex items-center justify-center size-10 rounded-full bg-noir-encre/60 text-text-on-dark-soft hover:text-text-on-dark hover:bg-or-poudre-clair/15 transition-colors border border-or-poudre-clair/20"
          >
            <X className="size-5" />
          </button>

          {/* Slide container */}
          <div className="relative w-full max-w-4xl">
            <motion.div
              key={current.kind}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="relative rounded-2xl border border-or-poudre-clair/25 shadow-2xl shadow-black/60 overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #3D1A0E 0%, #5C2A1A 45%, #7A2E12 100%)",
              }}
            >
              {/* Subtle texture overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at 20% 20%, rgba(244, 199, 123, 0.18) 0%, transparent 35%), radial-gradient(circle at 80% 80%, rgba(199, 91, 60, 0.25) 0%, transparent 40%)",
                }}
                aria-hidden="true"
              />

              <div className="relative p-5 sm:p-8 md:p-10 min-h-[60vh] sm:min-h-[480px] max-h-[80vh] overflow-y-auto aya-admin-scroll">
                {current.kind === "title" && <SlideTitle1 />}
                {current.kind === "problem" && <SlideProblem />}
                {current.kind === "solution" && <SlideSolution />}
                {current.kind === "market" && <SlideMarket />}
                {current.kind === "competition" && <SlideCompetition />}
                {current.kind === "product" && <SlideProduct />}
                {current.kind === "business" && <SlideBusiness />}
                {current.kind === "traction" && <SlideTraction />}
                {current.kind === "team" && <SlideTeam />}
                {current.kind === "ask" && <SlideAsk />}
              </div>
            </motion.div>

            {/* Navigation arrows */}
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              aria-label="Slide précédent"
              className="absolute left-1 sm:-left-14 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-10 rounded-full bg-noir-encre/60 text-text-on-dark-soft hover:text-text-on-dark hover:bg-or-poudre-clair/15 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-or-poudre-clair/20"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === SLIDES.length - 1}
              aria-label="Slide suivant"
              className="absolute right-1 sm:-right-14 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-10 rounded-full bg-noir-encre/60 text-text-on-dark-soft hover:text-text-on-dark hover:bg-or-poudre-clair/15 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-or-poudre-clair/20"
            >
              <ChevronRight className="size-5" />
            </button>

            {/* Dots */}
            <div className="mt-4 flex items-center justify-center gap-1.5 flex-wrap">
              {SLIDES.map((s, i) => (
                <button
                  key={s.kind}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Aller au slide ${i + 1} : ${SLIDE_LABELS[s.kind]}`}
                  aria-current={i === index ? "true" : undefined}
                  className={`group flex flex-col items-center gap-1 transition-all ${
                    i === index ? "scale-110" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <span
                    className={`block rounded-full transition-all ${
                      i === index
                        ? "size-2.5 bg-or-poudre-clair"
                        : "size-2 bg-or-poudre-clair/40 group-hover:bg-or-poudre-clair/70"
                    }`}
                  />
                  <span className="text-[9px] text-text-on-dark-muted hidden sm:block whitespace-nowrap">
                    {i === index ? SLIDE_LABELS[s.kind] : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PitchDeck;
