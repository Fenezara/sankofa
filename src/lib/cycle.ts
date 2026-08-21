/**
 * Sankofa — Cycle menstruel : prédictions & analyse
 *
 * Bibliothèque PURE (aucune dépendance Web Crypto, aucune I/O) qui calcule :
 *   - Longueur moyenne du cycle (sur les N derniers cycles)
 *   - Date prévue des prochaines règles
 *   - Fenêtre fertile (±5 jours autour de l'ovulation estimée)
 *   - Date d'ovulation prévue (J-14 avant prochaines règles)
 *   - Détection de retard (si retard > 5 jours → alerte test de grossesse)
 *
 * Hypothèses médicales (OMS / cycles eumenorrheic 21-35 jours) :
 *   - Phase lutéale stable ~14 jours
 *   - Ovulation = J-14 par rapport au début des prochaines règles
 *   - Fenêtre fertile = ovulation ±3 jours (capacité de survie spermato/ovule)
 *     → en pratique : J-19 à J-11 avant prochaines règles (soit ~8 jours fertile)
 *
 * Aucune lib externe : tout est calculé avec Date native (jours en ms).
 *
 * Toutes les fonctions sont déterministes et ne lisent ni localStorage ni Date.now()
 * (la date "actuelle" est passée en paramètre pour être testable et SSR-safe).
 */

/** Flux menstruel — niveau de saignement. */
export type Flow = "light" | "medium" | "heavy";

/** Symptômes menstruels courants (multi-select côté UI). */
export const CYCLE_SYMPTOMS = [
  "crampes",
  "migraine",
  "fatigue",
  "sautes_humeur",
  "seins_douloureux",
  "ballonnements",
] as const;
export type CycleSymptom = (typeof CYCLE_SYMPTOMS)[number];

/** Labels français pour l'affichage UI. */
export const SYMPTOM_LABELS: Record<CycleSymptom, string> = {
  crampes: "Crampes",
  migraine: "Migraine",
  fatigue: "Fatigue",
  sautes_humeur: "Sautes d'humeur",
  seins_douloureux: "Seins douloureux",
  ballonnements: "Ballonnements",
};

export const FLOW_LABELS: Record<Flow, string> = {
  light: "Léger",
  medium: "Moyen",
  heavy: "Abondant",
};

/** Une entrée de cycle menstruel (un cycle = du startDate au prochain startDate). */
export interface CycleEntry {
  /** ISO date (YYYY-MM-DD) du PREMIER jour des règles. */
  startDate: string;
  /** ISO date (YYYY-MM-DD) du dernier jour des règles (optionnel). */
  endDate?: string;
  /** Symptômes ressentis pendant ce cycle. */
  symptoms: CycleSymptom[];
  /** Intensité du flux. */
  flow: Flow;
  /** Notes personnelles (chiffrées avec le reste du blob). */
  notes?: string;
}

/* =========================================================
   CONSTANTES MÉDICALES
   ========================================================= */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Longueur de cycle par défaut si pas assez de données (moyenne OMS 28j). */
export const DEFAULT_CYCLE_LENGTH = 28;
/** Phase lutéale standard (ovulation = J-14 avant prochaines règles). */
export const LUTEAL_PHASE_LENGTH = 14;
/** Fenêtre fertile : nb de jours avant ovulation (début fertile). */
export const FERTILE_WINDOW_BEFORE = 5;
/** Fenêtre fertile : nb de jours après ovulation (fin fertile). */
export const FERTILE_WINDOW_AFTER = 1;
/** Seuil de retard (jours) pour alerter sur un éventuel test de grossesse. */
export const LATE_THRESHOLD_DAYS = 5;
/** Plage normale de cycle (21-35j selon OMS). */
export const MIN_NORMAL_CYCLE = 21;
export const MAX_NORMAL_CYCLE = 35;

/* =========================================================
   HELPERS DATE (UTC-safe, sans timezone drift)
   ========================================================= */

/** Parse une date ISO YYYY-MM-DD en UTC midnight (évite le décalage tz). */
export function parseDate(iso: string): Date {
  // YYYY-MM-DD → traité comme UTC pour éviter les sauts de jour
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** Formate une Date en YYYY-MM-DD (UTC, stable). */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ajoute N jours à une Date (sans muter l'originale). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Différence en jours entiers (b - a), positive si b après a. */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Date du jour en UTC midnight (utilisé pour "aujourd'hui"). */
export function todayUTC(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/* =========================================================
   PRÉDICTIONS
   ========================================================= */

/** Trie les cycles par startDate croissant (le plus ancien d'abord). */
export function sortCycles(cycles: CycleEntry[]): CycleEntry[] {
  return [...cycles].sort(
    (a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime(),
  );
}

/**
 * Calcule la longueur moyenne du cycle à partir des cycles enregistrés.
 * - Besoin d'au moins 2 cycles avec startDate pour calculer un intervalle.
 * - Si 1 seul cycle → DEFAULT_CYCLE_LENGTH (28j, moyenne OMS).
 * - Si 0 cycle → DEFAULT_CYCLE_LENGTH.
 *
 * Filtre les intervalles anormaux (< MIN ou > MAX) pour ne pas biaiser
 * la moyenne (cycles irréguliers, erreurs de saisie).
 */
export function averageCycleLength(cycles: CycleEntry[]): number {
  if (!cycles || cycles.length === 0) return DEFAULT_CYCLE_LENGTH;
  const sorted = sortCycles(cycles);
  if (sorted.length === 1) return DEFAULT_CYCLE_LENGTH;

  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDate(sorted[i - 1].startDate);
    const curr = parseDate(sorted[i].startDate);
    const interval = diffDays(prev, curr);
    if (interval >= MIN_NORMAL_CYCLE && interval <= MAX_NORMAL_CYCLE) {
      intervals.push(interval);
    }
  }
  if (intervals.length === 0) return DEFAULT_CYCLE_LENGTH;
  const sum = intervals.reduce((acc, n) => acc + n, 0);
  return Math.round(sum / intervals.length);
}

/**
 * Calcule la longueur moyenne des règles (durée de saignement).
 * - Si endDate absent sur toutes les entrées → DEFAULT_PERIOD_LENGTH (5j).
 */
export function averagePeriodLength(cycles: CycleEntry[]): number {
  const withEnd = cycles.filter((c) => c.endDate);
  if (withEnd.length === 0) return 5; // 5 jours par défaut
  const sum = withEnd.reduce((acc, c) => {
    const start = parseDate(c.startDate!);
    const end = parseDate(c.endDate!);
    return acc + (diffDays(start, end) + 1);
  }, 0);
  return Math.round(sum / withEnd.length);
}

/**
 * Prédit la date des prochaines règles.
 *
 * Algorithme :
 *   - Dernier cycle enregistré → startDate
 *   - + longueur moyenne du cycle → date prévue
 *
 * Retourne aussi un score de confiance (0-1) :
 *   - 0.3 si 0 ou 1 cycle (moyenne OMS, peu fiable)
 *   - 0.5 si 2-3 cycles
 *   - 0.7 si 4-5 cycles
 *   - 0.85 si 6+ cycles (cycles réguliers)
 *
 * @param cycles Historique des cycles
 * @param now    Date "actuelle" (injectée pour SSR/test) — défaut new Date()
 */
export function predictNextPeriod(
  cycles: CycleEntry[],
  now: Date = new Date(),
): { nextDate: Date; confidence: number } {
  const sorted = sortCycles(cycles);
  if (sorted.length === 0) {
    // Aucune donnée → on ne peut rien prédire. Retourne aujourd'hui + 28j
    // (date "fantôme" qui ne sera pas affichée, mais évite un crash).
    return {
      nextDate: addDays(todayUTC(now), DEFAULT_CYCLE_LENGTH),
      confidence: 0,
    };
  }

  const lastCycle = sorted[sorted.length - 1];
  const lastStart = parseDate(lastCycle.startDate);
  const cycleLen = averageCycleLength(sorted);
  const nextDate = addDays(lastStart, cycleLen);

  // Score de confiance
  let confidence = 0.3;
  if (sorted.length >= 6) confidence = 0.85;
  else if (sorted.length >= 4) confidence = 0.7;
  else if (sorted.length >= 2) confidence = 0.5;

  return { nextDate, confidence };
}

/**
 * Prédit la date d'ovulation (J-14 avant les prochaines règles).
 *
 * L'ovulation survient ~14 jours avant le début des prochaines règles
 * (phase lutéale stable chez la plupart des femmes eumenorrheic).
 */
export function predictOvulation(nextPeriod: Date): Date {
  return addDays(nextPeriod, -LUTEAL_PHASE_LENGTH);
}

/**
 * Calcule la fenêtre fertile autour de l'ovulation prévue.
 *
 * La fenêtre fertile s'étend de ~5 jours avant l'ovulation à ~1 jour après
 * (durée de survie des spermatozoïdes dans le tractus génital + vie courte
 * de l'ovule).
 *
 * Soit : [ovulation - 5 ; ovulation + 1] (7 jours au total).
 */
export function predictFertileWindow(nextPeriod: Date): {
  start: Date;
  end: Date;
  ovulation: Date;
} {
  const ovulation = predictOvulation(nextPeriod);
  return {
    start: addDays(ovulation, -FERTILE_WINDOW_BEFORE),
    end: addDays(ovulation, FERTILE_WINDOW_AFTER),
    ovulation,
  };
}

/**
 * Détecte si les règles sont en retard par rapport à la prédiction.
 *
 * - `late` = true si aujourd'hui > nextDate ET au moins 1 cycle enregistré
 * - `daysLate` = nombre de jours de retard (0 si pas en retard)
 *
 * Si pas de cycle enregistré → jamais en retard (impossible à savoir).
 *
 * @param cycles Historique des cycles
 * @param now    Date "actuelle" (injectée pour SSR/test) — défaut new Date()
 */
export function isLate(
  cycles: CycleEntry[],
  now: Date = new Date(),
): { late: boolean; daysLate: number } {
  if (!cycles || cycles.length === 0) {
    return { late: false, daysLate: 0 };
  }
  const { nextDate } = predictNextPeriod(cycles, now);
  const today = todayUTC(now);
  const daysLate = diffDays(nextDate, today);
  if (daysLate > 0) {
    return { late: true, daysLate };
  }
  return { late: false, daysLate: 0 };
}

/* =========================================================
   HELPERS UI
   ========================================================= */

/**
 * Formate une date en format "lisible" français (ex: "12 mars").
 * UTC-safe, sans dépendance à Intl (pour compat maximale).
 */
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatHumanDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_FR[date.getUTCMonth()]}`;
}

/**
 * Formate un nombre de jours en "dans X jours" / "aujourd'hui" / "il y a X jours".
 */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  if (days > 0) return `dans ${days} jours`;
  return `il y a ${Math.abs(days)} jours`;
}

/**
 * Détermine si une date donnée tombe dans une plage de jours (inclusif).
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/**
 * Liste les jours d'un mois donné (grille 6×7 = 42 cellules, dim→sam).
 * Retourne null pour les cellules vides (jours hors du mois).
 *
 * @param year   4 digits
 * @param month  0-11 (JS Date convention)
 */
export function getMonthGrid(
  year: number,
  month: number,
): (Date | null)[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  // 0 = dimanche (getUTCDay convention)
  const firstDayOfWeek = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const grid: (Date | null)[] = [];
  // Cellules vides avant le 1er
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  // Jours du mois
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(Date.UTC(year, month, d)));
  }
  // Cellules vides après le dernier jour (pour compléter la grille 42)
  while (grid.length < 42) grid.push(null);
  return grid;
}

const WEEKDAYS_FR = ["D", "L", "M", "M", "J", "V", "S"];
export const WEEKDAY_LABELS = WEEKDAYS_FR;

const MONTHS_FR_SHORT = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function getMonthLabel(year: number, month: number): string {
  return `${MONTHS_FR_SHORT[month]} ${year}`;
}
