// One part of Home asking the session card to start. The drop ("Your week
// is here.") and the session card are separate pieces of the same page;
// the drop's one button starts the week's first session, so it asks here
// and the card (TodaySession), which owns the session player, answers.
// Nothing is stored; with no card on the page the ask does nothing.
type Listener = () => void;
const listeners = new Set<Listener>();

export function askToStartSession(): void {
  for (const l of [...listeners]) l();
}

export function onAskToStartSession(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
