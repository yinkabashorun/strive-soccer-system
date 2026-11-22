"use client";

import { useState, useTransition } from "react";
import { removeFromWaitlist, textWaitlist } from "@/lib/elite/waitlist-actions";
import { FIRST_GROUP_AT, inFirstGroup } from "@/lib/elite/waitlist";
import type { WaitlistOverviewRow } from "@/lib/elite/waitlist-server";

// The waitlist on /coach/free (migration 075): how many are on it, how
// many brought FIRST_GROUP_AT teammates, the two "the app is open" texts
// (only once free sign-up is open), and everyone on the list.
export function WaitlistAdmin({ rows, open }: { rows: WaitlistOverviewRow[]; open: boolean }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstGroup = rows.filter((r) => inFirstGroup(r.teammates));
  const notTexted = rows.filter((r) => !r.invited_at);
  const fromTeammates = rows.filter((r) => r.referred_by).length;

  function send(who: "first_group" | "everyone") {
    setNote(null);
    setError(null);
    start(async () => {
      const res = await textWaitlist(who);
      if (!res.ok) return setError(res.error);
      setNote(
        `${res.sent} texted.` +
          (res.failed ? ` ${res.failed} did not go through.` : "") +
          (res.left ? ` ${res.left} left, tap again to send the next batch.` : "")
      );
    });
  }

  function remove(id: string, name: string) {
    if (!confirm(`Take ${name} off the waitlist?`)) return;
    start(async () => {
      const res = await removeFromWaitlist(id);
      if (!res.ok) setError(res.error);
    });
  }

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-black uppercase tracking-tight">Waitlist</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        While free sign-up is closed, the join link is the waitlist. Players 13 and older leave their
        phone, get their own link, and are texted once. Bringing {FIRST_GROUP_AT} teammates puts a
        player in the first group. Everyone is tagged waitlist in GHL.
      </p>

      <div className="mt-4 grid max-w-2xl grid-cols-3 gap-3">
        {[
          [rows.length, "On the list"],
          [firstGroup.length, "First group"],
          [fromTeammates, "Came from a teammate"],
        ].map(([n, label]) => (
          <div key={label as string} className="elite-card p-4">
            <div className="font-display text-3xl font-black tabular-nums">{n}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">{label}</div>
          </div>
        ))}
      </div>

      <div className="elite-card mt-4 max-w-2xl p-5">
        <div className="text-[15px] font-semibold text-bone">The app is open text</div>
        <div className="mt-0.5 text-sm text-white/60">
          {open
            ? `Sends "<First>, the Strive app is open and you're in. Make your account here: ... Let's get to work." Once per person, up to 40 a tap. ${notTexted.length} not texted yet.`
            : "Open free sign-up first. Until it is open, the link in the text would show the waitlist again."}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn" disabled={!open || pending} onClick={() => send("first_group")}>
            Text the first group
          </button>
          <button type="button" className="btn" disabled={!open || pending} onClick={() => send("everyone")}>
            Text everyone not yet texted
          </button>
        </div>
        {note && <p className="mt-3 text-sm text-white/70">{note}</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-white/50">
            <tr className="border-b border-white/[0.08]">
              {["Name", "Phone", "Plays for", "Teammates", "Sent by", "Joined", "Texted", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-white/60">
                  Nobody is on the waitlist yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.05] last:border-0">
                <td className="px-4 py-3 font-semibold text-bone">
                  {r.first_name} {r.last_name}
                </td>
                <td className="px-4 py-3 text-white/70">{r.phone}</td>
                <td className="px-4 py-3 text-white/70">{r.team ?? ""}</td>
                <td className={"px-4 py-3 tabular-nums " + (inFirstGroup(r.teammates) ? "text-accent" : "text-white/70")}>
                  {r.teammates}
                </td>
                <td className="px-4 py-3 text-white/70">{r.referrer ?? ""}</td>
                <td className="px-4 py-3 text-white/70">{day(r.created_at)}</td>
                <td className="px-4 py-3 text-white/70">{r.invited_at ? day(r.invited_at) : ""}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-white/50 underline underline-offset-2"
                    disabled={pending}
                    onClick={() => remove(r.id, `${r.first_name} ${r.last_name}`)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
