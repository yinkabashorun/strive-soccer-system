import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { DeviceSettings } from "@/components/elite/DeviceSettings";
import { NoticeChoices } from "@/components/elite/NoticeChoices";
import { loadNoticePrefs } from "@/lib/elite/notice-prefs-server";
import { NO_NOTICE_PREFS } from "@/lib/elite/notice-prefs";
import { getViewer } from "@/lib/elite/session";
import { signOut } from "@/lib/elite/auth-actions";
import { deleteGate } from "@/lib/elite/account";
import { SUPPORT_EMAIL, concernMailto } from "@/lib/elite/support";
import { consentDue } from "@/lib/elite/legal-server";
import { freeAccountFor } from "@/lib/elite/tracker-server";
import { profileSetupDue } from "@/lib/elite/account-profile";
import { FREE_SETTINGS, FREE_WEEK } from "@/lib/elite/tracker";
import { hasRunningSubscription, memberTier } from "@/lib/elite/pro-server";
import { isPro } from "@/lib/elite/tiers";
import { PRO_PRICE_LINE } from "@/lib/elite/pro";
import { CancelProForm } from "@/components/elite/CancelProForm";

export const metadata = { title: "Account · Strive Elite" };

// The Account page: who is signed in, this phone's settings, help, the
// legal pages, sign out and "Delete my account". It sits outside the
// player shell on purpose, so a member whose membership is paused can
// still reach it (and still delete their account).
export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");

  const isPlayer = viewer.role === "player";
  // A free account (069) has its own Settings inside the free app. It
  // lands here only while new terms wait for its yes (the free app shows
  // the agreement until then), so it can still sign out or delete.
  const tracker = viewer.demo ? null : await freeAccountFor(viewer);
  // ...or while it still owes its profile photo and username (081): the
  // one-time screen links here so Sign out and Delete stay reachable.
  // ...or while it still has to confirm its email (093).
  if (tracker && !viewer.emailDue && !profileSetupDue(viewer.setup) && !(await consentDue(viewer.profile.id))) redirect(FREE_SETTINGS);
  const isMember = isPlayer && !tracker;
  const home = !isPlayer ? "/coach" : tracker ? FREE_WEEK : "/dashboard";
  const canDelete = deleteGate(viewer).allowed;
  // Strive Pro (074): the membership is paid by card here, so it is
  // cancelled here too.
  const pro = isMember && !viewer.demo && viewer.playerId ? isPro(await memberTier(viewer.playerId)) : false;
  const canCancelPro = pro && (await hasRunningSubscription(viewer.profile.id));
  // What we may tell this member about, and when the one reminder comes
  // (088). Nothing to show before the migration is applied.
  const notices = isMember && !viewer.demo ? await loadNoticePrefs(viewer).catch(() => NO_NOTICE_PREFS) : NO_NOTICE_PREFS;
  const hasNoticeChoices = notices.topics.length > 0 || notices.reminder !== null;

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6">
        <Link
          href={home}
          className="inline-flex h-11 items-center gap-1 pr-3 text-[15px] font-medium text-white/70"
        >
          <ChevronLeft className="h-5 w-5" /> Back
        </Link>

        <div className="mt-3 flex items-center gap-4">
          <Avatar name={viewer.profile.full_name} color={viewer.profile.avatar_color} size={56} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-black uppercase leading-none">
              {viewer.profile.full_name}
            </h1>
            <div className="mt-1 truncate text-sm text-white/60">
              {viewer.demo ? "The example player" : viewer.profile.email}
            </div>
          </div>
        </div>

        {isMember && (
          <Group title="Your training">
            <Row href="/progress" label="Progress" detail="Time trained and your coach's ratings" />
          </Group>
        )}
        {pro && (
          <Group title="Strive Pro">
            <div className="p-4">
              <span className="block text-[15px] font-semibold text-bone">{PRO_PRICE_LINE}</span>
              <span className="mt-0.5 block text-sm text-white/60">
                {canCancelPro ? "Your membership is on." : "No membership running."}
              </span>
            </div>
            {canCancelPro && <CancelProForm />}
          </Group>
        )}
        {!viewer.demo && (
          <Group title="Sign-in">
            <Row href="/account/password" label="Change password" />
          </Group>
        )}

        <Group title="This phone">
          <DeviceSettings showNotifications={isMember && !viewer.demo} />
        </Group>

        {hasNoticeChoices && (
          <Group title="Notifications">
            <NoticeChoices prefs={notices} />
          </Group>
        )}

        <Group title="Help">
          <Row href="/support" label="Support" detail={SUPPORT_EMAIL} />
          <Row
            href={concernMailto(viewer.profile.full_name)}
            label="Report a concern"
            detail="About a message, a clip or anything else in the app"
          />
        </Group>

        <Group title="The fine print">
          <Row href="/privacy" label="Privacy policy" />
          <Row href="/terms" label="Terms of service" />
        </Group>

        <form action={signOut} className="mt-8">
          <button className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone">
            Sign out
          </button>
        </form>

        {canDelete && (
          <div className="mt-6 text-center">
            <Link href="/account/delete" className="tap text-sm font-medium text-red-300 underline-offset-4 hover:underline">
              Delete my account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
        {title}
      </h2>
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.06]">
        {children}
      </div>
    </section>
  );
}

function Row({ href, label, detail }: { href: string; label: string; detail?: string }) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-bone">{label}</span>
        {detail && <span className="mt-0.5 block truncate text-sm text-white/60">{detail}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
    </>
  );
  const cls = "flex min-h-[56px] items-center gap-3 p-4";
  return href.startsWith("mailto:") ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
