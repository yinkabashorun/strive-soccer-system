import { fmtDuration, type AreaMinutes } from "@/lib/elite/time-trained";

// Where the time went, area by area: all-time minutes with a bar, and this
// week's minutes beside them in gold when the player has trained that area
// this week. Shown on You and on Progress. Nothing here counts what was
// missed: an area only appears once time has gone into it.
export function TimeByArea({ areas, title = "Time by area" }: { areas: AreaMinutes[]; title?: string }) {
  if (areas.length === 0) return null;
  const top = areas[0]?.minutes ?? 0;
  return (
    <section className="m-card space-y-3.5 p-5" aria-label={title}>
      <h2 className="text-[17px] font-semibold text-bone">{title}</h2>
      {areas.map((a) => (
        <div key={a.area}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="font-semibold text-white/85">{a.area}</span>
            <span className="flex items-baseline gap-2">
              {a.thisWeek > 0 && (
                <span className="text-[12px] font-semibold text-gold">+{fmtDuration(a.thisWeek)} this week</span>
              )}
              <span className="m-num tabular-nums text-bone">{fmtDuration(a.minutes)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${top ? Math.max(4, Math.round((a.minutes / top) * 100)) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
