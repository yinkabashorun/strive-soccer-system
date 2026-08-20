// Demo-tour guide strips — shown ONLY to demo visitors (viewer.demo).
//
// The tour is an invisible funnel: each page gets one clear, helpful
// explainer that orients a cold visitor AND answers the exact objection
// that page exists to kill — without ever sounding like selling. Real
// players never see these.

const COPY: Record<
  string,
  { headline: string; body: string }
> = {
  home: {
    headline: "You're touring Marcus — 13, attacking mid, 7 weeks in.",
    body: "Everything here is live and real. One session at a time, about 40 minutes, built by his coach around what he did last week. Your player gets exactly this from day one.",
  },
  training: {
    headline: "No templates. This week was written for Marcus.",
    body: "Every weekend the coach reads what he completed, what he struggled with, and how his skills are trending — then builds next week from scratch. It unlocks Monday morning, every Monday.",
  },
  progress: {
    headline: "Scored by the coach — not by vibes.",
    body: "Seven skills rated from real training and tracked all season, so you watch improvement happen instead of wondering if it is. Parents get a weekly report with these numbers too.",
  },
  film: {
    headline: "A real coach watches real footage.",
    body: "Once a month Marcus sends a game link and gets a personal breakdown. Players post their schedule too — Coach shows up to Northern Virginia games.",
  },
  coach: {
    headline: "A direct line — not a group chat.",
    body: "Questions between sessions get answered by the coach, and every weekly check-in shapes the next plan. This is what personal coaching looks like between sessions.",
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
      <a
        href="https://strivesoccer100x.com"
        className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
      >
        Want this for your player? Claim a spot →
      </a>
    </section>
  );
}
