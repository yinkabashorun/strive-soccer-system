// The waitlist's database side (migration 075). Every write goes through
// the service client: the table has no insert or update policy, so a
// visitor's browser can never write a row or read anyone else's.

import { createServiceClient } from "./supabase/server";
import { APP_URL } from "./app-url";
import { sendSms, tagGhlContact } from "./sms";
import { initialsOf } from "./tracker";
import type { Birth } from "./tracker";
import {
  FIRST_GROUP_AT,
  newWaitlistCode,
  teammateCounts,
  waitlistLink,
  welcomeText,
  type WaitlistFields,
  type WaitlistRow,
} from "./waitlist";

export type JoinResult =
  | { kind: "ok"; id: string }
  | { kind: "exists" }
  | { kind: "offline" };

export async function joinWaitlist(input: {
  fields: WaitlistFields;
  birth: Birth;
  ref: string | null;
  source: string | null;
}): Promise<JoinResult> {
  const admin = createServiceClient();
  if (!admin) return { kind: "offline" };
  const { fields, birth } = input;

  // The code of whoever sent the link counts only if it is a real row
  // with another number.
  let referredBy: string | null = null;
  let referrer: { first_name: string; phone: string } | null = null;
  if (input.ref) {
    const { data } = await admin
      .from("elite_waitlist")
      .select("first_name, phone")
      .eq("code", input.ref)
      .maybeSingle();
    if (data && data.phone !== fields.phone) {
      referredBy = input.ref;
      referrer = data as { first_name: string; phone: string };
    } else if (!data) {
      // A free player's own code, from a card or video they shared while
      // sign-up is closed (share-link.ts): it counts as who sent them.
      const { data: free } = await admin
        .from("elite_trackers")
        .select("profile_id, phone")
        .eq("referral_code", input.ref)
        .maybeSingle();
      if (free && (free as { phone: string | null }).phone !== fields.phone) referredBy = input.ref;
    }
  }

  // A new code each try; a clash on the code (one in a trillion) just
  // takes another. A clash on the phone means the number is already in.
  let id: string | null = null;
  let code = "";
  for (let i = 0; i < 5 && !id; i++) {
    code = newWaitlistCode();
    const { data, error } = await admin
      .from("elite_waitlist")
      .insert({
        first_name: fields.firstName,
        last_name: fields.lastName,
        phone: fields.phone,
        birth_month: birth.month,
        birth_year: birth.year,
        team: fields.team,
        code,
        referred_by: referredBy,
        source: input.source,
      })
      .select("id")
      .single();
    if (data?.id) id = data.id as string;
    else if (error?.code === "23505" && /phone/.test(error.message ?? "")) return { kind: "exists" };
    else if (error && error.code !== "23505") return { kind: "offline" };
  }
  if (!id) return { kind: "offline" };

  // Into GHL with the waitlist tag, then the one text with their link.
  // Both best-effort: the row is what counts.
  await tagGhlContact(fields.phone, { firstName: fields.firstName, lastName: fields.lastName }, ["waitlist"]);
  await sendSms(fields.phone, fields.firstName, welcomeText(fields.firstName, waitlistLink(APP_URL, code)));

  // The teammate who sent the link: one text the moment their third
  // teammate joins, and never again after that.
  if (referredBy && referrer) {
    const { count } = await admin
      .from("elite_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", referredBy);
    if (count === FIRST_GROUP_AT) {
      await sendSms(
        referrer.phone,
        referrer.first_name,
        `${referrer.first_name}, ${FIRST_GROUP_AT} teammates joined with your link. You're in the first group we let in when the Strive app opens.`
      );
    }
  }
  return { kind: "ok", id };
}

export type WaitlistStatus = { first: string; code: string; phone: string; teammates: number };

// What the player who joined on this device sees when they come back.
export async function waitlistStatus(id: string | undefined | null): Promise<WaitlistStatus | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_waitlist")
    .select("first_name, code, phone")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { count } = await admin
    .from("elite_waitlist")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", data.code);
  return { first: data.first_name as string, code: data.code as string, phone: data.phone as string, teammates: count ?? 0 };
}

// Who sent a waitlist link: a first name and initials, nothing more,
// the same as a friend's link on the free app.
export async function waitlistInviter(code: string | null): Promise<{ first: string; initials: string } | null> {
  if (!code) return null;
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_waitlist")
    .select("first_name, last_name")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  return { first: data.first_name as string, initials: initialsOf(`${data.first_name} ${data.last_name}`) };
}

export type WaitlistOverviewRow = WaitlistRow & {
  teammates: number;
  referrer: string | null;
  pickup_sent_at: string | null;
};

// The coach's list at /coach/free: everyone, newest first, with how many
// teammates each brought and who sent them.
export async function getWaitlist(): Promise<WaitlistOverviewRow[]> {
  const admin = createServiceClient();
  if (!admin) return [];
  const { data } = await admin
    .from("elite_waitlist")
    .select("id, first_name, last_name, phone, team, code, referred_by, invited_at, created_at, pickup_sent_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as (WaitlistRow & { pickup_sent_at: string | null })[];
  const counts = teammateCounts(rows);
  const byCode = new Map(rows.map((r) => [r.code, `${r.first_name} ${r.last_name}`]));
  return rows.map((r) => ({
    ...r,
    teammates: counts.get(r.code) ?? 0,
    referrer: r.referred_by ? byCode.get(r.referred_by) ?? null : null,
  }));
}
