// Shown the instant a tab is tapped, while the next screen is fetched, so
// a tap always answers at once. It waits a beat before appearing: a screen
// that arrives quickly never flashes a placeholder (Apple HIG, Loading:
// "the best content-loading experience finishes before people become
// aware of it").
export default function PlayerLoading() {
  return (
    <div className="space-y-4 opacity-0 animate-fade-in [animation-delay:350ms]" aria-hidden>
      <div className="h-4 w-28 rounded-full bg-white/[0.06]" />
      <div className="h-9 w-56 rounded-xl bg-white/[0.07]" />
      <div className="h-56 rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
      <div className="h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
      <div className="h-20 rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
    </div>
  );
}
