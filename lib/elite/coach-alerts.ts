// Text the coaches (Nov 5 2026, Coach Yinka: "whenever they upload a
// video, it should send me a text ... to my phone number and to Coach
// Gary's"). Every coach or admin profile with an alert_phone gets the
// text; each coach sets their own number on the Calls page, so no number
// is kept in the repository. With nobody set yet, the plan builder's
// alert number (COACH_ALERT_PHONE) is the fallback so Coach Yinka is never
// left unreached. Best-effort: never throws, never blocks an upload.
import { createServiceClient } from "./supabase/server";
import { normalizePhone, sendSms } from "./sms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://thestriveapp.com";

export type CoachRecipient = { name: string; phone: string };

// One entry per distinct number, from the coach profiles.
export function dedupeRecipients(
  rows: { full_name: string | null; alert_phone: string | null }[]
): CoachRecipient[] {
  const seen = new Set<string>();
  const out: CoachRecipient[] = [];
  for (const r of rows) {
    const phone = r.alert_phone ? normalizePhone(r.alert_phone) : null;
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ name: (r.full_name || "Coach").trim().split(" ")[0] || "Coach", phone });
  }
  return out;
}

// The admin (Coach Yinka) is never left unreached: when no admin profile
// has a number set yet, the plan builder's alert number is added to the
// list. Once he sets his own, that one is used.
export function withFallback(
  rows: { full_name: string | null; alert_phone: string | null; role?: string | null }[],
  fallback: string
): CoachRecipient[] {
  const set = dedupeRecipients(rows);
  const adminHasNumber = rows.some((r) => r.role === "admin" && r.alert_phone && normalizePhone(r.alert_phone));
  if (adminHasNumber) return set;
  return dedupeRecipients([...rows, { full_name: "Coach", alert_phone: fallback }]);
}

export async function coachRecipients(): Promise<CoachRecipient[]> {
  const admin = createServiceClient();
  const fallback = process.env.COACH_ALERT_PHONE || "+15712856635";
  if (!admin) return [];
  const { data, error } = await admin
    .from("elite_profiles")
    .select("full_name, alert_phone, role")
    .in("role", ["coach", "admin"]);
  const rows = error
    ? []
    : ((data as { full_name: string | null; alert_phone: string | null; role: string | null }[] | null) ?? []);
  return withFallback(rows, fallback);
}

export async function textCoaches(message: string): Promise<number> {
  const recipients = await coachRecipients();
  const results = await Promise.all(
    recipients.map((r) => sendSms(r.phone, r.name, message).catch(() => false))
  );
  return results.filter(Boolean).length;
}

export function coachProfileUrl(playerId: string): string {
  return `${APP_URL}/coach/players/${playerId}`;
}

export function coachCallsUrl(): string {
  return `${APP_URL}/coach/calls`;
}

// The upload texts. Plain, no sign-off, no em dash, one text each.
export function clipText(player: string, drill: string, url: string): string {
  return `${player} sent a clip of ${drill}. Watch it and reply: ${url}`;
}

export function progressText(player: string, week: number, url: string): string {
  return `${player} filmed their week ${week} progress clip. Watch it: ${url}`;
}

export function filmRoomText(player: string, added: number, total: number, when: string, url: string): string {
  return `${player} added ${added} clip${added === 1 ? "" : "s"} for the ${when} Film Room (${total} so far). Watch them: ${url}`;
}

export async function getAlertPhone(profileId: string): Promise<string> {
  const admin = createServiceClient();
  if (!admin) return "";
  const { data } = await admin.from("elite_profiles").select("alert_phone").eq("id", profileId).maybeSingle();
  return (data?.alert_phone as string | null) ?? "";
}
