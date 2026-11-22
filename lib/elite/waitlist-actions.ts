"use server";

// The coach's two waitlist actions at /coach/free (migration 075): text
// the "app is open" message, and take a person off the list when they
// ask. Coaches only; every write through the service client.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { APP_URL } from "./app-url";
import { sendSms } from "./sms";
import { isFreeSignupOpen } from "./tracker-server";
import { OPEN_FIRST_MESSAGE, inviteOrder, openText, type WaitlistRow } from "./waitlist";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const OFFLINE = "We could not reach the server. Try again in a minute.";

async function coachAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { kind: "no" as const };
  if (viewer.demo) return { kind: "demo" as const };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" as const };
  return { kind: "ok" as const, admin };
}

// Text the next batch the "app is open" message: the first group, or
// everyone not yet texted. Only while free sign-up is open, so the link
// in the text makes an account instead of showing the waitlist again.
// Each number is texted once (invited_at), and the text ledger (066)
// would refuse a second identical text the same day anyway.
export async function textWaitlist(
  who: "first_group" | "everyone"
): Promise<{ ok: true; sent: number; failed: number; left: number } | Fail> {
  const c = await coachAdmin();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true, sent: 0, failed: 0, left: 0 };
  if (!(await isFreeSignupOpen())) return fail(OPEN_FIRST_MESSAGE);

  const { data, error } = await c.admin
    .from("elite_waitlist")
    .select("id, first_name, last_name, phone, team, code, referred_by, invited_at, created_at")
    .limit(5000);
  if (error) return fail(OFFLINE);
  const rows = (data ?? []) as WaitlistRow[];
  const batch = inviteOrder(rows, who);

  let sent = 0;
  let failed = 0;
  for (const r of batch) {
    const ok = await sendSms(r.phone, r.first_name, openText(r.first_name, `${APP_URL}/join`));
    if (ok) {
      sent++;
      await c.admin.from("elite_waitlist").update({ invited_at: new Date().toISOString() }).eq("id", r.id);
    } else failed++;
  }
  const left = inviteOrder(rows, who, Number.MAX_SAFE_INTEGER).length - sent;
  revalidatePath("/coach/free");
  return { ok: true, sent, failed, left };
}

// Take one person off the list (they asked us to). Their row goes; the
// teammates they brought stay on the list.
export async function removeFromWaitlist(id: string): Promise<{ ok: true } | Fail> {
  const c = await coachAdmin();
  if (c.kind === "no") return fail("Only a coach can do this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin.from("elite_waitlist").delete().eq("id", id);
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true };
}
