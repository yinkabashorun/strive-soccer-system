import { TabEntrance } from "@/components/elite/TabEntrance";

// Every screen comes in once as it mounts, from the side it was asked for
// (components/elite/TabEntrance.tsx; the motion rules in experience.md:
// screens 0.3 s, reduced motion a plain fade).
export default function PlayerTemplate({ children }: { children: React.ReactNode }) {
  return <TabEntrance>{children}</TabEntrance>;
}
