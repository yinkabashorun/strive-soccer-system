// The free app's front door (/join) is its own full-screen page, like the
// free app itself: no header, and nothing on it leads to another website.
export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100svh] bg-black text-bone">{children}</div>;
}
