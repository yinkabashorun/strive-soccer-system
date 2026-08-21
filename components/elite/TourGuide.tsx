// Demo-tour guide strips — shown ONLY to demo visitors (viewer.demo).
//
// One strip per page, and each one says the minimum. The app itself is the
// pitch; these just orient. Premium brands never over-explain. Real players
// never see these.

const COPY: Record<
  string,
  { headline: string; body: string }
> = {
  home: {
    headline: "Meet Marcus, our example player.",
    body: "He isn't real. Everything else is. This is exactly what your player gets.",
  },
  training: {
    headline: "Built from scratch every week.",
    body: "We read how the week went, then write the next one. Unlocks Monday.",
  },
  progress: {
    headline: "Scored from real training.",
    body: "Seven skills, tracked all season.",
  },
  film: {
    headline: "We watch the real footage.",
    body: "One breakdown a month. Northern Virginia games, we show up.",
  },
  coach: {
    headline: "A direct line to us.",
    body: "Every check-in shapes the next week we build.",
  },
};

export function TourGuide({ page }: { page: keyof typeof COPY | string }) {
  const c = COPY[page] ?? COPY.home;
  return (
    <section className="rounded-3xl border border-accent/30 bg-accent/[0.06] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black">
          Live demo
        </span>
        <span className="font-display text-sm font-bold uppercase tracking-tight text-bone sm:text-base">
          {c.headline}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-white/65">{c.body}</p>
    </section>
  );
}
