// Strive Elite time model — everything runs on Virginia time
// (America/New_York). A training week is Monday→Sunday NY; new weeks
// unlock Monday morning. These helpers are the single source of truth for
// week math so "week 3" always means the player's third real week.

const NY = "America/New_York";

// Today's date in NY as YYYY-MM-DD.
export function nyToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: NY });
}

// 0 = Monday … 6 = Sunday, for a YYYY-MM-DD date string.
function mondayIndex(day: string): number {
  // Date-only strings parse as UTC midnight; getUTCDay is then exact.
  const js = new Date(day + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// The Monday (YYYY-MM-DD) of the current NY week, optionally offset.
export function mondayOfWeekNY(offsetWeeks = 0): string {
  const today = nyToday();
  return shiftDay(today, -mondayIndex(today) + offsetWeeks * 7);
}

// Next Monday strictly after today (if today IS Monday, the following one).
export function nextMondayNY(): string {
  return mondayOfWeekNY(1);
}

// Unlock instant for a given NY Monday: 10:00 UTC = 6am EDT / 5am EST —
// always early Monday morning in Virginia, year-round, no DST math.
export function unlockInstant(monday: string): string {
  return `${monday}T10:00:00.000Z`;
}

// Which week number (1-based) is live for a program that started on
// week1_monday. Before the start date, week 1.
export function liveWeekNumber(week1Monday: string | null | undefined): number {
  if (!week1Monday) return 1;
  const thisMonday = mondayOfWeekNY(0);
  const ms =
    new Date(thisMonday + "T00:00:00Z").getTime() -
    new Date(week1Monday + "T00:00:00Z").getTime();
  const weeks = Math.floor(ms / (7 * 864e5));
  return Math.max(1, weeks + 1);
}

// Short human date for a Monday, e.g. "Mon, Aug 24".
export function fmtMonday(monday: string): string {
  return new Date(monday + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: NY,
  });
}
