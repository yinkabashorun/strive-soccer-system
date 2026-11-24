// The badges, as pure rules (no database here, so they can be tested).
//
// Every badge is earned from data the app tracks: completions, sessions,
// minutes. Nothing subjective, nothing the system cannot prove, and
// nothing a break can take away. That last rule is Coach Yinka's (Oct 12
// 2026: "a break never costs"): no badge asks for days or weeks "in a
// row", and none is worded as a streak or a percentage.
//
// A badge already earned is never taken away. When a rule changes, the
// new rule must cover everyone the old one covered, the old title is
// listed under `formerly` so the member is not handed the same badge
// twice, and `presentAchievement` shows the old row in today's words.
import type { Achievement, Homework, PlayerSummary } from "./types";

export type AchievementRule = {
  title: string;
  detail: string;
  icon: string; // lucide name known to the ICONS map on the Progress page
  // What is engraved on the gold medal in the iPhone app, the way the
  // hours medals read "1H" and "3H": four characters at most.
  mark: string;
  // Titles this badge was stored under before a rule or wording change.
  formerly?: string[];
  earned: (hw: Homework[], s: PlayerSummary) => boolean;
};

// Weeks where every assigned drill is completed, sorted ascending.
export function fullWeeks(hw: Homework[]): number[] {
  const byWeek = new Map<number, { total: number; done: number }>();
  for (const h of hw) {
    const w = byWeek.get(h.week) ?? { total: 0, done: 0 };
    w.total++;
    if (h.completed) w.done++;
    byWeek.set(h.week, w);
  }
  return [...byWeek.entries()]
    .filter(([, w]) => w.total > 0 && w.done === w.total)
    .map(([week]) => week)
    .sort((a, b) => a - b);
}

export const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    title: "First Session",
    detail: "Your first full session, done",
    icon: "Sparkles",
    mark: "1ST",
    earned: (_hw, s) => s.sessions_completed >= 1,
  },
  {
    title: "Week Conquered",
    detail: "Every drill in a week, done",
    icon: "CheckCircle2",
    mark: "1 WK",
    earned: (hw) => fullWeeks(hw).length >= 1,
  },
  {
    // Any three full weeks. Until Nov 18 2026 this asked for three weeks
    // back to back, which a break could cost a player; three of any is
    // true for everyone the old rule was true for.
    title: "3 Full Weeks",
    detail: "Three weeks with every drill done",
    icon: "Trophy",
    mark: "3 WK",
    formerly: ["3 Perfect Weeks"],
    earned: (hw) => fullWeeks(hw).length >= 3,
  },
  {
    title: "10 Sessions",
    detail: "Ten full sessions in the bank",
    icon: "Flame",
    mark: "10",
    earned: (_hw, s) => s.sessions_completed >= 10,
  },
  // The sessions ladder (Nov 24 2026): 25, 50 and 100, the marks the
  // leading training apps hand out. Earned only by sessions finished, so
  // a break never costs one.
  {
    title: "25 Sessions",
    detail: "Twenty-five full sessions done",
    icon: "Flame",
    mark: "25",
    earned: (_hw, s) => s.sessions_completed >= 25,
  },
  {
    title: "50 Sessions",
    detail: "Fifty full sessions done",
    icon: "Flame",
    mark: "50",
    earned: (_hw, s) => s.sessions_completed >= 50,
  },
  {
    title: "100 Sessions",
    detail: "One hundred full sessions done",
    icon: "Trophy",
    mark: "100",
    earned: (_hw, s) => s.sessions_completed >= 100,
  },
  {
    title: "500 Minutes",
    detail: "500 minutes of focused training",
    icon: "Zap",
    mark: "500",
    earned: (_hw, s) => s.training_minutes >= 500,
  },
  {
    title: "1,000 Minutes",
    detail: "A thousand minutes in the bank",
    icon: "Target",
    mark: "1K",
    earned: (_hw, s) => s.training_minutes >= 1000,
  },
];

// The rules a player has newly met, given the titles already on file.
// A badge held under a former title counts as held.
export function newlyEarned(
  hw: Homework[],
  summary: PlayerSummary,
  have: Iterable<string>
): AchievementRule[] {
  const held = new Set(have);
  return ACHIEVEMENT_RULES.filter(
    (r) =>
      !held.has(r.title) &&
      !(r.formerly ?? []).some((t) => held.has(t)) &&
      r.earned(hw, summary)
  );
}

// Badges stored before a wording change, shown in today's words. The row
// in the database is left as it is; only what the member reads changes.
const RETIRED_WORDING: Record<string, { title: string; detail: string; mark?: string }> = {
  "3 Perfect Weeks": { title: "3 Full Weeks", detail: "Three weeks with every drill done" },
  // Retired as a rule on Oct 12 2026 (it punished a gap). Members who
  // earned it keep it, named for the work rather than the run.
  "7-Day Streak": { title: "7 Days Trained", detail: "Seven days of training, earned", mark: "7D" },
};

// The engraving for a badge, by the title the member reads (today's or the
// one it was stored under). null for a title no rule knows: the medal then
// carries a tick, never a made-up mark.
export const MARK_MAX = 4;
export function achievementMark(title: string): string | null {
  const rule = ACHIEVEMENT_RULES.find((r) => r.title === title || (r.formerly ?? []).includes(title));
  if (rule) return rule.mark;
  const retired = Object.entries(RETIRED_WORDING).find(([was, now]) => was === title || now.title === title);
  return retired?.[1].mark ?? null;
}

export function presentAchievement<T extends Pick<Achievement, "title" | "detail">>(a: T): T {
  const now = RETIRED_WORDING[a.title];
  return now ? { ...a, title: now.title, detail: now.detail } : a;
}

// One badge per title after re-wording: a member who somehow holds both
// the old and the new row sees it once (the earliest earned).
export function presentAchievements<T extends Pick<Achievement, "title" | "detail" | "earned_at">>(
  list: T[]
): T[] {
  const byTitle = new Map<string, T>();
  for (const a of list.map(presentAchievement)) {
    const seen = byTitle.get(a.title);
    if (!seen || a.earned_at < seen.earned_at) byTitle.set(a.title, a);
  }
  return [...byTitle.values()].sort((a, b) => b.earned_at.localeCompare(a.earned_at));
}
