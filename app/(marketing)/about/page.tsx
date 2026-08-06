import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/elite/Reveal";

export const metadata: Metadata = {
  title: "About · Strive Elite",
  description:
    "Strive Soccer FC is a DMV youth development brand built on creative, intelligent football. Strive Elite is our premium coaching system.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-32">
      <Reveal>
        <div className="eyebrow mb-4">Our story</div>
        <h1 className="display text-balance text-[clamp(2.5rem,7vw,4.5rem)]">
          For the players. By the players.
        </h1>
      </Reveal>

      <Reveal delay={100}>
        <div className="mt-10 space-y-6 text-lg leading-relaxed text-white/60">
          <p>
            Strive Soccer FC was founded in the DMV on a simple belief: youth
            players deserve creative, intelligent football — not robotic drills
            and cone-tapping. Ball mastery. Composure under pressure. Scanning.
            Slowing the game down.
          </p>
          <p>
            But we kept running into the same wall. A great session on Saturday
            doesn&apos;t matter much if nothing happens Sunday through Friday.
            The players who improved fastest were the ones who trained between
            sessions — with a plan, film to study, and someone holding them
            accountable.
          </p>
          <p>
            <span className="font-semibold text-bone">Strive Elite</span> is
            that system, turned into an app. Every session becomes a structured
            week: personalized homework, measurable progress, film analysis, and
            a parent report so families see exactly how their player is growing.
          </p>
          <p>
            It&apos;s not private training. It&apos;s a complete development
            program — the kind that turns talented kids into complete players.
          </p>
        </div>
      </Reveal>

      <Reveal delay={160}>
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["DMV", "Based in"],
            ["7", "Pillars tracked"],
            ["1-on-1", "Coaching"],
            ["Weekly", "Homework"],
          ].map(([n, l]) => (
            <div
              key={l}
              className="elite-card p-5 text-center"
            >
              <div className="font-display text-3xl font-black text-accent">
                {n}
              </div>
              <div className="mt-1 text-xs text-white/45">{l}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={220}>
        <div className="mt-14 rounded-4xl border border-white/8 bg-white/[0.02] p-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
            The Strive philosophy
          </h2>
          <ul className="mt-5 space-y-3 text-white/65">
            <li>· Touches before tricks. Always.</li>
            <li>· The fastest player is the one who decides fastest.</li>
            <li>· Composure is taught. So is panic. We teach composure.</li>
            <li>· Five focused minutes a day beats one forgotten camp.</li>
          </ul>
          <Link
            href="/signup"
            className="btn-accent mt-8 inline-flex px-6 py-3"
          >
            Join Strive Elite <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
