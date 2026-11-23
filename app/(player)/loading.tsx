// Shown the instant a tab is tapped while the next screen is still on its
// way. Every tab is fetched ahead of the tap (MemberNav, SwipeTabs), so it
// is rarely seen; when it is (a slow signal), it shows at once, with a
// quick fade. It used to wait 350 ms first, which on a phone left the
// screen blank for a third of a second after every tap: a blank screen
// reads as "nothing happened", a shape of the screen reads as "on its way"
// (Nov 23 2026, "when im clicking things there is a delay").
export default function PlayerLoading() {
  return (
    <div data-skeleton className="space-y-4 animate-fade-in [animation-duration:150ms]" aria-hidden>
      <div className="h-4 w-28 rounded-full bg-white/[0.06]" />
      <div className="h-9 w-56 rounded-xl bg-white/[0.07]" />
      <div className="h-56 rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
      <div className="h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
      <div className="h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
    </div>
  );
}
