// Bring your squad, on the server (the rules are in squad-pass.ts; the
// tables in migration 086). Everything here goes through the service
// client: no player can write a count or a month for themselves.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase/server";
import { notifyProfile } from "./notify";
import { squadPassNotice } from "./notices";
import { recordConsent } from "./legal-server";
import { createProMember, creditNextMonth, hasRunningSubscription } from "./pro-server";
import { getTracker, type Tracker } from "./tracker-server";
import { ageOf } from "./free-upgrade-server";
import { fmtBreakDate } from "./breaks";
import { nyDateOf } from "./reminders";
import { nyToday } from "./time";
import { shortName } from "./tracker";
import { isPro } from "./tiers";
import {
  PASS_DAYS,
  SQUAD_ALREADY_MEMBER,
  SQUAD_FAILED,
  SQUAD_KEPT_UNTIL_END,
  SQUAD_NOT_READY,
  buildSquad,
  paidNote,
  squadPrize,
  type SquadPrize,
  passEndsAt,
  passesEarned,
  type Squad,
  type SquadPerson,
} from "./squad-pass";
import type { Viewer } from "./session";

type Pass = {
  id: string;
  number: number;
  started_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  // when the month was used to make a paying member's next month free (091)
  credited_at?: string | null;
};
const PASS_COLUMNS = "id, number, started_at, ends_at, ended_at";

// Read with the 091 column when the database has it. Before 091 is applied
// that read is refused, and the months are read without it, so the card
// never loses an earned month over a column that is not there yet.
async function passesOf(admin: SupabaseClient, profileId: string): Promise<Pass[]> {
  const full = await admin.from("elite_pro_passes").select(`${PASS_COLUMNS}, credited_at`).eq("profile_id", profileId).order("number");
  if (!full.error) return (full.data as Pass[] | null) ?? [];
  const { data } = await admin.from("elite_pro_passes").select(PASS_COLUMNS).eq("profile_id", profileId).order("number");
  return (data as Pass[] | null) ?? [];
}

// What three teammates earn this account (lib/elite/squad-pass.ts
// squadPrize): read from its own member row and its card subscription.
async function prizeFor(admin: SupabaseClient, profileId: string): Promise<SquadPrize> {
  const { data } = await admin.from("elite_players").select("tier, subscription_status").eq("profile_id", profileId).maybeSingle();
  const row = data as { tier: string | null; subscription_status: string | null } | null;
  const memberOn = row?.subscription_status === "active" || row?.subscription_status === "trialing";
  const earnedMonthRunning = Boolean(row && isPro(row.tier) && row.subscription_status === "trialing");
  const paysByCard = Boolean(row && isPro(row.tier) && row.subscription_status === "active") && (await hasRunningSubscription(profileId));
  return squadPrize({ memberOn, earnedMonthRunning, paysByCard });
}

const isRunning = (p: Pass, now: number) => Boolean(p.started_at && p.ends_at && !p.ended_at && new Date(p.ends_at).getTime() > now);

// A free player posted a training photo. If a teammate brought them and
// they have not been counted yet, they count now, and the teammate who
// brought them gets any month that completes. Safe to call on every post:
// the teammate's id is the key of the count, the (player, number) pair the
// key of a month, so nothing is ever counted or earned twice.
export async function countTeammate(posterId: string): Promise<void> {
  const admin = createServiceClient();
  if (!admin) return;
  const { data: me } = await admin.from("elite_trackers").select("referred_by").eq("profile_id", posterId).maybeSingle();
  const broughtBy = (me as { referred_by: string | null } | null)?.referred_by ?? null;
  if (!broughtBy || broughtBy === posterId) return;
  const { error } = await admin.from("elite_squad_counts").insert({ teammate: posterId, profile_id: broughtBy });
  if (error) return; // already counted (the key), or the table is not there yet
  await grantPasses(admin, broughtBy);
}

async function grantPasses(admin: SupabaseClient, profileId: string): Promise<void> {
  const { count } = await admin.from("elite_squad_counts").select("teammate", { count: "exact", head: true }).eq("profile_id", profileId);
  const earned = passesEarned(count ?? 0);
  const held = new Set((await passesOf(admin, profileId)).map((p) => p.number));
  let fresh = 0;
  for (let n = 1; n <= earned; n++) {
    if (held.has(n)) continue;
    const { error } = await admin.from("elite_pro_passes").insert({ profile_id: profileId, number: n, days: PASS_DAYS });
    if (!error) fresh++;
  }
  // told once: only the insert that made the month sends
  if (fresh > 0) await notifyProfile(profileId, squadPassNotice({ number: earned }));
}

// What the invite card shows a free player.
export async function squadFor(profileId: string): Promise<Squad> {
  const empty = buildSquad({ trained: [], joined: [], passes: [], runningUntil: null });
  const admin = createServiceClient();
  if (!admin) return empty;
  const [{ data: brought }, { data: counts }, passes, prize] = await Promise.all([
    admin.from("elite_trackers").select("profile_id, created_at").eq("referred_by", profileId).order("created_at"),
    admin.from("elite_squad_counts").select("teammate, counted_at").eq("profile_id", profileId).order("counted_at"),
    passesOf(admin, profileId).catch(() => [] as Pass[]),
    prizeFor(admin, profileId).catch((): SquadPrize => "month"),
  ]);
  const counted = ((counts as { teammate: string }[] | null) ?? []).map((c) => c.teammate);
  const joinedIds = ((brought as { profile_id: string }[] | null) ?? []).map((b) => b.profile_id).filter((id) => !counted.includes(id));
  const ids = [...new Set([...counted, ...joinedIds])];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await admin.from("elite_profiles").select("id, full_name").in("id", ids);
    for (const p of (data as { id: string; full_name: string }[] | null) ?? []) names.set(p.id, shortName(p.full_name));
  }
  // a teammate who has since deleted their account still counts, unnamed
  const person = (id: string): SquadPerson => ({ id, name: names.get(id) ?? "A teammate" });
  const now = Date.now();
  const running = passes.filter((p) => isRunning(p, now)).sort((a, b) => (a.ends_at as string).localeCompare(b.ends_at as string));
  const last = running[running.length - 1];
  const until = last ? nyDateOf(last.ends_at as string) : null;
  return buildSquad({
    trained: counted.map(person),
    joined: joinedIds.map(person),
    passes: passes.map((p) => ({ started: Boolean(p.started_at), running: isRunning(p, now) })),
    runningUntil: until ? fmtBreakDate(until) : null,
    prize,
    note: paidNote(
      passes.map((p) => p.credited_at),
      new Date(now)
    ),
  });
}

export type PassStart = { ok: true } | { ok: false; error: string; status: number };

// Start an earned month. The account's own Strive Pro row is made (or
// reused) exactly as a paid start makes it, and switched on as "trialing"
// until the month's end; no card is asked for. The quiz, the first week
// and every week after follow as they do for any member.
export async function startPass(viewer: Viewer, userAgent: string | null): Promise<PassStart> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: SQUAD_FAILED, status: 503 };
  const profileId = viewer.profile.id;
  const passes = await passesOf(admin, profileId);
  const next = passes.find((p) => !p.started_at);
  if (!next) return { ok: false, error: SQUAD_NOT_READY, status: 409 };

  const ownRow = async () => {
    const { data } = await admin.from("elite_players").select("id, tier, subscription_status").eq("profile_id", profileId).maybeSingle();
    return (data as { id: string; tier: string | null; subscription_status: string | null } | null) ?? null;
  };
  let row = await ownRow();
  // A PLAYER WHO PAYS BY CARD: their next month is free (the month's price
  // as a credit on their Stripe account). Anyone else who is already a
  // member (another membership, or switched on with no card) keeps the
  // month for later, as before.
  if (row && isPro(row.tier) && row.subscription_status === "active") return creditPass(admin, profileId, next);
  if (row && !isPro(row.tier)) return { ok: false, error: SQUAD_ALREADY_MEMBER, status: 409 };
  if (!row) {
    const tracker: Tracker | null = await getTracker(profileId);
    if (!tracker) return { ok: false, error: SQUAD_FAILED, status: 409 };
    const made = await createProMember(admin, {
      profileId,
      fullName: viewer.profile.full_name,
      age: ageOf(tracker, nyToday()) ?? 0,
      email: viewer.profile.email,
      phone: tracker.phone ?? "",
    });
    row = made ? await ownRow() : null;
    if (!row) return { ok: false, error: SQUAD_FAILED, status: 500 };
  }

  const now = new Date();
  const running = passes.filter((p) => isRunning(p, now.getTime())).map((p) => new Date(p.ends_at as string));
  const latest = running.length ? new Date(Math.max(...running.map((d) => d.getTime()))) : null;
  const ends = passEndsAt(now, latest);
  // only a month that has not been started is started: two taps start one
  const { data: started, error } = await admin
    .from("elite_pro_passes")
    .update({ started_at: now.toISOString(), ends_at: ends.toISOString() })
    .eq("id", next.id)
    .is("started_at", null)
    .select("id");
  if (error) return { ok: false, error: SQUAD_FAILED, status: 500 };
  if (!started?.length) return { ok: true }; // the other tap started it

  const on = await admin.from("elite_players").update({ subscription_status: "trialing" }).eq("id", row.id).neq("subscription_status", "active");
  if (on.error) {
    // the month is given back rather than left started with nothing on
    await admin.from("elite_pro_passes").update({ started_at: null, ends_at: null }).eq("id", next.id);
    return { ok: false, error: SQUAD_FAILED, status: 500 };
  }
  await recordConsent({ profileId, source: "in_app", userAgent }).catch(() => false);
  return { ok: true };
}

// A paying member's earned month, used as their next month free.
//
// The order is what makes it safe to tap twice, retry, or lose signal:
//   1. the month is CLAIMED first (only a month nobody has used can be
//      claimed, so two taps claim one), and closed in the same write: it is
//      used, not running, so the hourly job never touches it
//   2. then Stripe is asked for the credit, with the month's own id as the
//      idempotency key, so the same month can never be credited twice
//   3. if Stripe says no, the claim is taken back and the month is whole
// Before migration 091 the claim is refused by the database (the column is
// not there), nothing reaches Stripe, and the month is kept as it was.
async function creditPass(admin: SupabaseClient, profileId: string, pass: Pass): Promise<PassStart> {
  const now = new Date().toISOString();
  const { data: claimed, error } = await admin
    .from("elite_pro_passes")
    .update({ started_at: now, ends_at: now, ended_at: now, credited_at: now })
    .eq("id", pass.id)
    .is("started_at", null)
    .select("id");
  if (error) return { ok: false, error: SQUAD_ALREADY_MEMBER, status: 409 };
  if (!claimed?.length) return { ok: true }; // the other tap used it
  const giveBack = () =>
    admin.from("elite_pro_passes").update({ started_at: null, ends_at: null, ended_at: null, credited_at: null }).eq("id", pass.id);

  const credit = await creditNextMonth(profileId, pass.id);
  if (credit.result === "credited") {
    // Stripe's own record of it, kept beside the month (best effort: the
    // credit stands whether or not this line is written)
    await admin.from("elite_pro_passes").update({ stripe_credit_id: credit.id }).eq("id", pass.id);
    return { ok: true };
  }
  await giveBack();
  if (credit.result === "ending") return { ok: false, error: SQUAD_KEPT_UNTIL_END, status: 409 };
  if (credit.result === "none") return { ok: false, error: SQUAD_ALREADY_MEMBER, status: 409 };
  return { ok: false, error: SQUAD_FAILED, status: 502 };
}

// The hourly job: an earned month whose time is up is closed. The
// membership goes back to "none" (a free account again, its log, friends
// and clubs untouched) unless another earned month is still running or the
// family has started paying in the meantime.
// Has this account ever had an earned month that has since ended?
export async function hadEarnedMonth(profileId: string): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const { count, error } = await admin
    .from("elite_pro_passes")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .not("ended_at", "is", null);
  return !error && (count ?? 0) > 0;
}

export async function endDuePasses(): Promise<{ ended: number }> {
  const admin = createServiceClient();
  if (!admin) return { ended: 0 };
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("elite_pro_passes")
    .select(`${PASS_COLUMNS}, profile_id`)
    .not("started_at", "is", null)
    .is("ended_at", null)
    .lte("ends_at", nowIso);
  const due = (data as (Pass & { profile_id: string })[] | null) ?? [];
  let ended = 0;
  for (const p of due) {
    const others = (await passesOf(admin, p.profile_id)).filter((o) => o.id !== p.id && isRunning(o, Date.now()));
    if (others.length === 0) {
      const { data: row } = await admin.from("elite_players").select("id, tier, subscription_status").eq("profile_id", p.profile_id).maybeSingle();
      const player = row as { id: string; tier: string | null; subscription_status: string | null } | null;
      if (player && isPro(player.tier) && player.subscription_status === "trialing") {
        // a card subscription that is running keeps the membership on
        const { data: paid } = await admin
          .from("elite_subscriptions")
          .select("id")
          .eq("profile_id", p.profile_id)
          .in("status", ["active", "trialing", "past_due"])
          .limit(1);
        if (!paid?.length) {
          const off = await admin.from("elite_players").update({ subscription_status: "none" }).eq("id", player.id).eq("subscription_status", "trialing");
          if (off.error) continue; // tried again next hour
        }
      }
    }
    const closed = await admin.from("elite_pro_passes").update({ ended_at: nowIso }).eq("id", p.id).is("ended_at", null);
    if (!closed.error) ended++;
  }
  return { ended };
}
