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
    headline: "Meet Marcus — our example player.",
    body: "Marcus isn't real, but everything else is. This is exactly the app your player gets: one session at a time, about 40 minutes, a new week we build around them every weekend. We fast-forwarded Marcus a few weeks so you can see all of it working.",
  },
  training: {
    headline: "No templates. We build each week from scratch.",
    body: "Every weekend we read what got completed, what they struggled with, and how their skills are trending — then we write the next week around it. It unlocks Monday morning, every Monday.",
  },
  progress: {
    headline: "We score these from real training — not vibes.",
    body: "Seven skills, rated from actual sessions and tracked all season, so you watch improvement happen instead of wondering. You get a weekly report with these numbers too.",
  },
  film: {
    headline: "We watch the real footage.",
    body: "Once a month your player sends us a game link and we break it down personally. Post the game schedule too — we show up to Northern Virginia games.",
  },
  coach: {
    headline: "A direct line to us — not a group chat.",
    body: "Questions between sessions get answered, and every weekly check-in shapes the next plan we build. This is what personal coaching looks like between sessions.",
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
