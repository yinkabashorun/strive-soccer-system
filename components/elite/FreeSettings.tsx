"use client";

import { useState } from "react";
import { DeviceSettings } from "./DeviceSettings";
import { NoticeChoices } from "./NoticeChoices";
import type { NoticePrefs } from "@/lib/elite/notice-prefs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ActionSheet } from "./ActionSheet";
import { AuraRing, FreeAvatar } from "./FreeAvatar";
import { IconBlock, IconCalendar, IconChevron, IconClock, IconHelp, IconLink, IconLock, IconShield } from "./FreeIcons";
import { FreeTopBar } from "./FreeTopBar";
import { sendLink } from "./send-link";

// Settings for a free account (the mock, screen 11): the profile card on
// top, then the training target and days, the link and the blocked list,
// help, sign out and Delete my account. Members keep their own Account
// page; nothing here is a member setting.
export function FreeSettings({
  me,
  targetLine,
  daysLine,
  blockedCount,
  inviteLink,
  canChangePassword,
  notices,
  signOut,
}: {
  me: { name: string; initials: string; photo: string | null; level: number; progress: number };
  targetLine: string;
  daysLine: string | null;
  blockedCount: number;
  inviteLink: string;
  canChangePassword: boolean;
  // what this player may be told about (088): Friends, Clubs
  notices: NoticePrefs;
  signOut: () => Promise<void>;
}) {
  const router = useRouter();
  const [legal, setLegal] = useState(false);
  const [copied, setCopied] = useState(false);

  async function send() {
    if ((await sendLink(inviteLink)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div>
      <FreeTopBar back="/log/u/me" title="Settings" />

      <Link href="/log/settings/profile" className="mx-[18px] mt-1.5 flex items-center gap-[14px] rounded-[18px] bg-[#141414] p-[14px]">
        <AuraRing progress={me.progress} level={me.level} size={64}>
          <FreeAvatar photo={me.photo} initials={me.initials} size={54} you />
        </AuraRing>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[17px] font-bold">{me.name}</b>
          <span className="block text-[13px] text-white/60">Edit profile, photo and Playing for</span>
        </span>
        <IconChevron size={18} className="shrink-0 text-white/50" />
      </Link>

      <div className="pl-[18px]">
        <Head>Your training</Head>
        <Row href="/log/quiz" icon={<IconClock />} label="Weekly target" value={targetLine} />
        {daysLine && <Row href="/log/days" icon={<IconCalendar />} label="My training days" value={daysLine} />}

        <Head>This phone</Head>
        <div className="-ml-4">
          <DeviceSettings showNotifications variant="free" />
        </div>

        {notices.topics.length > 0 && (
          <>
            <Head>Notifications</Head>
            <div className="-ml-4">
              <NoticeChoices prefs={notices} />
            </div>
          </>
        )}

        <Head>Friends</Head>
        <Row onClick={send} icon={<IconLink />} label={copied ? "Link copied" : "Send my link"} chevron />
        <Row href="/log/settings/blocked" icon={<IconBlock />} label="Blocked" value={String(blockedCount)} />

        <Head>Help</Head>
        <Row href="/support" icon={<IconHelp />} label="Support" chevron />
        <Row onClick={() => setLegal(true)} icon={<IconShield />} label="Privacy and terms" chevron />
        {canChangePassword && <Row href="/account/password" icon={<IconLock />} label="Change password" chevron />}

        <div className="pt-5" />
        <form action={signOut}>
          <button className="flex h-[54px] w-full items-center pr-[18px] text-left text-[16px] font-semibold text-bone">Sign out</button>
        </form>
        <Link href="/account/delete" className="flex h-[54px] items-center pr-[18px] text-[16px] font-semibold text-[#ff5a4e]">
          Delete my account
        </Link>
      </div>

      {legal && (
        <ActionSheet
          label="Privacy and terms"
          title="Privacy and terms"
          onClose={() => setLegal(false)}
          rows={[
            { label: "Privacy policy", icon: <IconShield />, onClick: () => router.push("/privacy") },
            { label: "Terms of service", icon: <IconShield />, onClick: () => router.push("/terms") },
          ]}
        />
      )}
    </div>
  );
}

function Head({ children }: { children: ReactNode }) {
  return <h2 className="pb-1 pt-5 text-[13px] font-semibold text-white/60">{children}</h2>;
}

function Row({
  href,
  onClick,
  icon,
  label,
  value,
  chevron,
}: {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  value?: string;
  chevron?: boolean;
}) {
  const inner = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
      {value !== undefined && <span className="ml-auto shrink-0 text-[14px] font-medium text-white/60">{value}</span>}
      {chevron && <IconChevron size={18} className="ml-auto shrink-0 text-white/50" />}
    </>
  );
  const cls = "flex h-[54px] w-full items-center gap-4 pr-[18px] text-left text-[16px] font-semibold text-bone";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
