"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelPlanAsCoach,
  dismissPlanReports,
  markEntryPaid,
  saveEvent,
  setClubCountyAsCoach,
  setEventOpen,
} from "@/lib/elite/club-teams-actions";
import { COUNTY_GROUPS, WAIVER_REQUIRED_MESSAGE, countyName, nyInstant, organizedBy } from "@/lib/elite/club-teams";
import type { CoachEvent, TeamsOverview } from "@/lib/elite/club-teams-coach";

type Res = { ok: true } | { ok: false; error: string };

// Clubs as teams on /coach/free (077). Nothing in the app waits on this
// card: clubs plan for themselves and results confirm themselves. Here a
// coach CAN act: a reported session or game first (cancel it, or no
// action), then every session and game of the last two weeks and ahead
// (cancel any), then the Strive events (make one, open entries once the
// waiver link is set, mark entries paid), then the county and "Open to
// games" of the clubs a coach made.
export function TeamsAdmin({ data }: { data: TeamsOverview }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<CoachEvent | "new" | null>(null);

  function act(run: () => Promise<Res>, then?: () => void) {
    setError(null);
    start(async () => {
      const res = await run();
      if (!res.ok) return setError(res.error);
      then?.();
      router.refresh();
    });
  }

  const reported = data.plans.filter((p) => p.reports.length > 0);
  const rest = data.plans.filter((p) => p.reports.length === 0);
  const btn = "h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone disabled:opacity-60";

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-black uppercase tracking-tight">Club sessions, games and Strive events</h2>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        Clubs plan their own training and games; every one is organized by a club, seen only by the clubs in it, and
        results confirm themselves. Nothing here has to be done for the app to work. Strive events are ours.
      </p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {reported.length > 0 && (
        <div className="mt-4 rounded-2xl border border-red-400/40 p-4">
          <h3 className="text-sm font-semibold text-red-300">Reported sessions and games</h3>
          <ul className="mt-2 space-y-3">
            {reported.map((p) => (
              <li key={p.id}>
                <div className="font-semibold text-bone">
                  {p.kind === "game" ? `${p.organizer} vs ${p.opponent}` : `${p.organizer} training`} · {p.when}
                </div>
                <div className="text-sm text-white/60">
                  {p.place} · {organizedBy(p.organizer)} · {p.status}
                </div>
                <div className="text-sm text-white/60">{p.reports.map((r) => `${r.reporter}: ${r.reason}`).join(" · ")}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className={btn} onClick={() => act(() => cancelPlanAsCoach(p.id))}>
                    Cancel it
                  </button>
                  <button type="button" disabled={busy} className={btn} onClick={() => act(() => dismissPlanReports(p.id))}>
                    No action
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-white/50">
            <tr className="border-b border-white/[0.08]">
              {["What", "Organized by", "When", "Where", "Status", "In", "Result", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rest.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-white/60">
                  No club has planned anything in the last two weeks or ahead.
                </td>
              </tr>
            )}
            {rest.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.05] last:border-0">
                <td className="px-4 py-3 text-bone">{p.kind === "game" ? `Game vs ${p.opponent}` : "Club training"}</td>
                <td className="px-4 py-3 text-white/70">{p.organizer}</td>
                <td className="px-4 py-3 text-white/70">{p.when}</td>
                <td className="px-4 py-3 text-white/70">{p.place}</td>
                <td className="px-4 py-3 text-white/70">{p.status}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">{p.ins}</td>
                <td className="px-4 py-3 text-white/70">{p.result ?? ""}</td>
                <td className="px-4 py-2">
                  {p.status !== "cancelled" && p.status !== "passed" && (
                    <button type="button" disabled={busy} className={btn} onClick={() => act(() => cancelPlanAsCoach(p.id))}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-black uppercase tracking-tight">Strive events</h3>
        <button type="button" className="btn-accent h-11 px-4" onClick={() => setEditing("new")}>
          New event
        </button>
      </div>
      {editing && <EventForm event={editing === "new" ? null : editing} busy={busy} onCancel={() => setEditing(null)} onSave={(id, input) => act(() => saveEvent(id, input), () => setEditing(null))} />}
      {data.events.length === 0 ? (
        <p className="mt-3 text-sm text-white/60">No Strive events yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {data.events.map((e) => (
            <li key={e.id} className="elite-card p-4">
              <div className="font-semibold text-bone">{e.name}</div>
              <div className="text-sm text-white/60">
                {e.when} · {e.venue} · {e.price_text} · up to {e.roster_max}, {e.max_age} and under
              </div>
              <div className="mt-1 text-sm text-white/60">{e.open ? "Taking entries" : "Closed"}</div>
              {!e.waiver_url && <div className="mt-1 text-sm text-amber-300">{WAIVER_REQUIRED_MESSAGE}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => setEditing(e)}>
                  Edit
                </button>
                <button type="button" disabled={busy} className={btn} onClick={() => act(() => setEventOpen(e.id, !e.open))}>
                  {e.open ? "Close entries" : "Open entries"}
                </button>
              </div>
              {e.entries.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {e.entries.map((x) => (
                    <li key={x.id} className="rounded-xl border border-white/10 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-bone">{x.club}</span>
                        <span className={x.state === "paid" ? "text-accent" : "text-white/70"}>{x.line}</span>
                      </div>
                      <div className="mt-1 text-white/60">
                        {x.roster.map((r) => `${r.name}${r.in ? "" : " (not answered)"}`).join(", ")}
                      </div>
                      <div className="mt-1 text-white/60">{x.waivers} waiver acceptances recorded</div>
                      <button type="button" disabled={busy} className={btn + " mt-2"} onClick={() => act(() => markEntryPaid(x.id, x.state !== "paid"))}>
                        {x.state === "paid" ? "Mark not paid" : "Mark paid"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {data.coachClubs.length > 0 && (
        <>
          <h3 className="mt-6 font-display text-xl font-black uppercase tracking-tight">Clubs a coach made: county and games</h3>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {data.coachClubs.map((c) => (
              <CoachClubRow key={c.id} club={c} busy={busy} onSave={(county, open) => act(() => setClubCountyAsCoach(c.id, county, open))} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CoachClubRow({
  club,
  busy,
  onSave,
}: {
  club: { id: string; name: string; county: string | null; open: boolean };
  busy: boolean;
  onSave: (county: string | null, open: boolean) => void;
}) {
  const [county, setCounty] = useState(club.county ?? "");
  const [open, setOpen] = useState(club.open);
  return (
    <li className="elite-card p-4">
      <div className="font-semibold text-bone">{club.name}</div>
      <div className="text-sm text-white/60">{countyName(club.county) ?? "No county"} · {club.open ? "open to games" : "not open to games"}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={county}
          onChange={(e) => setCounty(e.target.value)}
          aria-label={`County for ${club.name}`}
          className="h-11 rounded-xl border border-white/10 bg-black px-3 text-sm text-bone"
        >
          <option value="">No county</option>
          {COUNTY_GROUPS.map((g) => (
            <optgroup key={g.state} label={g.label}>
              {g.counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <label className="flex h-11 items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={open} disabled={!county} onChange={(e) => setOpen(e.target.checked)} />
          Open to games
        </label>
        <button type="button" disabled={busy} className="btn-accent h-11 px-4" onClick={() => onSave(county || null, Boolean(county) && open)}>
          Save
        </button>
      </div>
    </li>
  );
}

// A coach's event form. Times are New York time.
function EventForm({
  event,
  busy,
  onCancel,
  onSave,
}: {
  event: CoachEvent | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (id: string | null, input: Record<string, unknown>) => void;
}) {
  const nyLocal = (iso: string) => {
    const d = new Date(iso).toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false });
    const [day, time] = d.split(", ");
    return `${day}T${time.slice(0, 5)}`;
  };
  const [f, setF] = useState({
    name: event?.name ?? "",
    when: event ? nyLocal(event.starts_at) : "",
    venue: event?.venue ?? "",
    price: event?.price_text ?? "",
    rosterMax: String(event?.roster_max ?? 9),
    maxAge: String(event?.max_age ?? 21),
    paymentUrl: event?.payment_url ?? "",
    waiverUrl: event?.waiver_url ?? "",
  });
  const field = (k: keyof typeof f, label: string, type = "text") => (
    <label className="block text-sm text-white/70">
      {label}
      <input
        type={type}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[15px] text-bone focus:outline-none"
      />
    </label>
  );
  return (
    <div className="mt-3 grid max-w-2xl gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2">
      {field("name", "Name")}
      {field("when", "Starts (New York time)", "datetime-local")}
      {field("venue", "Venue")}
      {field("price", "Entry price, as players read it")}
      {field("rosterMax", "Roster size", "number")}
      {field("maxAge", "Oldest age allowed", "number")}
      {field("paymentUrl", "Payment link (https)")}
      {field("waiverUrl", "Waiver link (https), needed to open entries")}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={busy}
          className="btn-accent h-11 px-4"
          onClick={() => {
            const [day, time] = f.when.split("T");
            onSave(event?.id ?? null, {
              name: f.name,
              startsAt: day && time ? nyInstant(day, time) ?? "" : "",
              venue: f.venue,
              price: f.price,
              rosterMax: Number(f.rosterMax),
              maxAge: Number(f.maxAge),
              paymentUrl: f.paymentUrl,
              waiverUrl: f.waiverUrl,
            });
          }}
        >
          Save
        </button>
        <button type="button" className="h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
