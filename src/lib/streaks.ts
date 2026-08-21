const STREAK_KEY = "sankofa:streak";

interface StreakData {
  current: number;
  longest: number;
  lastVisit: string;
  totalDays: number;
}

const DEFAULT_STREAK: StreakData = {
  current: 0,
  longest: 0,
  lastVisit: "",
  totalDays: 0,
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getStreak(): StreakData {
  if (typeof window === "undefined") return DEFAULT_STREAK;
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return DEFAULT_STREAK;
    return { ...DEFAULT_STREAK, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STREAK;
  }
}

export function updateStreak(): StreakData {
  if (typeof window === "undefined") return DEFAULT_STREAK;
  const data = getStreak();
  const today = todayStr();

  if (data.lastVisit === today) return data;

  let newCurrent: number;
  if (data.lastVisit === yesterdayStr()) {
    newCurrent = data.current + 1;
  } else {
    newCurrent = 1;
  }

  const updated: StreakData = {
    current: newCurrent,
    longest: Math.max(data.longest, newCurrent),
    lastVisit: today,
    totalDays: data.totalDays + 1,
  };

  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  } catch {}

  return updated;
}

export function getStreakBadge(streak: number): { label: string; emoji: string } {
  if (streak >= 100) return { label: "Sage", emoji: "🦉" };
  if (streak >= 30) return { label: "Confiant·e", emoji: "🌟" };
  if (streak >= 7) return { label: "Régulier·ère", emoji: "🔥" };
  if (streak >= 3) return { label: "Motivé·e", emoji: "💪" };
  if (streak >= 1) return { label: "Premier pas", emoji: "🌱" };
  return { label: "Nouveau·elle", emoji: "✨" };
}

export function getBaobabStage(streak: number): number {
  if (streak >= 100) return 6;
  if (streak >= 30) return 5;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}
