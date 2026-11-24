// Send to a parent, on the server (the words and shapes are in
// parent-link.ts). The page is public and signs nobody in: everything it
// shows and does is reached through the player's own long random code.
import { randomBytes } from "node:crypto";
import { createServiceClient } from "./supabase/server";
import { APP_URL } from "./app-url";
import { recordConsent } from "./legal-server";
import { PAYMENTS_OFF_MESSAGE, PRO_PRICE_LINE } from "./pro";
import { createProMember, openProCheckout } from "./pro-server";
import { ageOf } from "./free-upgrade-server";
import { readIntake, setUpgradeCheckout } from "./free-intake-server";
import { attributesWeakestFirst } from "./quiz";
import { areasPhrase } from "./free-intake";
import { getTracker, getWeekLogs } from "./tracker-server";
import { fmtDuration } from "./time-trained";
import { nyToday } from "./time";
import { isPro } from "./tiers";
import { PARENT_ALREADY_ON, PARENT_NEEDS_BOXES, PARENT_NOT_FOUND, cleanParentCode, parentLink, parentPath, parentProofLine } from "./parent-link";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
function newCode(): string {
  const bytes = randomBytes(26);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out;
}

// The player's own link to send. The code is made once and kept.
export async function parentLinkFor(profileId: string): Promise<string | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin.from("elite_trackers").select("parent_code").eq("profile_id", profileId).maybeSingle();
  if (!data) return null;
  let code = cleanParentCode((data as { parent_code: string | null }).parent_code);
  if (!code) {
    const fresh = newCode();
    // only an account with no code takes one: two requests keep one code
    await admin.from("elite_trackers").update({ parent_code: fresh }).eq("profile_id", profileId).is("parent_code", null);
    const { data: now } = await admin.from("elite_trackers").select("parent_code").eq("profile_id", profileId).maybeSingle();
    code = cleanParentCode((now as { parent_code: string | null } | null)?.parent_code);
  }
  return code ? parentLink(APP_URL, code) : null;
}

type Owner = { profileId: string; fullName: string; email: string };

async function ownerOf(code: string): Promise<Owner | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data: t } = await admin.from("elite_trackers").select("profile_id").eq("parent_code", code).maybeSingle();
  const profileId = (t as { profile_id: string } | null)?.profile_id;
  if (!profileId) return null;
  const { data: p } = await admin.from("elite_profiles").select("full_name, email").eq("id", profileId).maybeSingle();
  if (!p) return null;
  return { profileId, fullName: (p as { full_name: string }).full_name, email: (p as { email: string }).email };
}

export type ParentPage = { first: string; areas: string | null; proof: string | null; price: string; on: boolean };

// What the parent's page shows: the player's first name, what their first
// week goes after (from the quiz they took, when they took it), the price.
export async function parentPageFor(rawCode: unknown): Promise<ParentPage | null> {
  const code = cleanParentCode(rawCode);
  if (!code) return null;
  const owner = await ownerOf(code);
  if (!owner) return null;
  const admin = createServiceClient();
  const [intake, row, logs] = await Promise.all([
    readIntake(owner.profileId).catch(() => null),
    admin ? admin.from("elite_players").select("subscription_status").eq("profile_id", owner.profileId).maybeSingle() : null,
    getWeekLogs(owner.profileId, nyToday()).catch(() => []),
  ]);
  const first = owner.fullName.trim().split(/\s+/)[0] || "Your player";
  const trained = logs.filter((l) => l.kind !== "gym").reduce((sum, l) => sum + l.minutes, 0);
  const status = (row?.data as { subscription_status: string | null } | null)?.subscription_status ?? "none";
  const weakest = intake?.answers ? attributesWeakestFirst(intake.answers.attrs).slice(0, 2) : [];
  return {
    first,
    areas: areasPhrase(weakest),
    proof: parentProofLine(first, trained, fmtDuration(trained)),
    price: PRO_PRICE_LINE,
    on: status === "active",
  };
}

export type ParentStart = { ok: true; url: string } | { ok: false; error: string };

// The parent agreed and tapped Start: the player's own Strive Pro row is
// made (or reused) exactly as the player starting it makes it, the
// parent's agreement is recorded with their name, and the card checkout
// opens for THAT player. Paying switches the membership on (the webhook,
// or the page the checkout comes back to).
export async function startParentCheckout(input: {
  code: unknown;
  guardian: boolean;
  terms: boolean;
  guardianName: string;
  email: string;
  userAgent: string | null;
}): Promise<ParentStart> {
  const code = cleanParentCode(input.code);
  const owner = code ? await ownerOf(code) : null;
  if (!code || !owner) return { ok: false, error: PARENT_NOT_FOUND };
  const name = input.guardianName.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!input.guardian || !input.terms || name.length < 3) return { ok: false, error: PARENT_NEEDS_BOXES };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: PAYMENTS_OFF_MESSAGE };

  const ownRow = async () => {
    const { data } = await admin.from("elite_players").select("id, tier, subscription_status").eq("profile_id", owner.profileId).maybeSingle();
    return (data as { id: string; tier: string | null; subscription_status: string | null } | null) ?? null;
  };
  let row = await ownRow();
  if (row && (!isPro(row.tier) || row.subscription_status === "active")) return { ok: false, error: PARENT_ALREADY_ON };
  if (!row) {
    const tracker = await getTracker(owner.profileId);
    if (!tracker) return { ok: false, error: PARENT_NOT_FOUND };
    const made = await createProMember(admin, {
      profileId: owner.profileId,
      fullName: owner.fullName,
      age: ageOf(tracker, nyToday()) ?? 0,
      email: input.email.trim() || owner.email,
      phone: tracker.phone ?? "",
    });
    row = made ? await ownRow() : null;
    if (!row) return { ok: false, error: PAYMENTS_OFF_MESSAGE };
  }
  // On an earned month ("trialing", no card behind it) the card is started
  // over it: nothing is switched off while the parent is paying. A
  // "trialing" account with a card subscription already running has
  // nothing to pay.
  let overEarnedMonth = false;
  if (row.subscription_status === "trialing") {
    const { data: paid } = await admin
      .from("elite_subscriptions")
      .select("id")
      .eq("profile_id", owner.profileId)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1);
    if (paid?.length) return { ok: false, error: PARENT_ALREADY_ON };
    overEarnedMonth = true;
  }
  await recordConsent({ profileId: owner.profileId, source: "signup", guardianName: name, userAgent: input.userAgent }).catch(() => false);

  const checkout = await openProCheckout({
    profileId: owner.profileId,
    playerId: row.id,
    email: input.email.trim() || owner.email,
    returnTo: "parent",
    cancelPath: parentPath(code),
    overEarnedMonth,
  });
  if (!checkout.ok) return { ok: false, error: checkout.error };
  await setUpgradeCheckout(owner.profileId, checkout.sessionId).catch(() => undefined);
  return { ok: true, url: checkout.url };
}
