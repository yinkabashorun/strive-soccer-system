// Tabs switch with a short crossfade, never a page load or a spinner
// (experience.md, the motion rules). A template mounts afresh on every
// navigation, so each screen fades in once; reduced motion keeps it a
// plain, quick fade (globals.css).
export default function PlayerTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-tab-in">{children}</div>;
}
