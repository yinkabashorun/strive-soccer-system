import { Reveal } from "@/components/elite/Reveal";
import { MetaPixel } from "@/components/elite/MetaPixel";
import { FIVE_V_FIVE as E, dayOf, lastDayBefore, money, phaseAt, priceAt, registerTarget } from "@/lib/events/five-v-five";

// Same pixel as /demo, so 5v5 visitors can be retargeted. Public page,
// no app data, nothing about members.
const META_PIXEL_ID = "1655175349021847";

export function FiveVFiveLanding() {
  const now = Date.now();
  const phase = phaseAt(now);
  const price = priceAt(now);
  const target = registerTarget(now);
  const earlyLast = lastDayBefore(E.earlyBirdEndsIso);
  const standardFrom = dayOf(E.earlyBirdEndsIso);
  const finalDay = lastDayBefore(E.registrationClosesIso);

  const included: [string, string][] = [
    [`${E.minGroupGames} games minimum`, `Every team plays at least ${E.minGroupGames} games in the group stage.`],
    ["Every game recorded", "Every game on the day is filmed."],
    [`Picked up by ${E.coverage}`, `The event is covered by ${E.coverage}.`],
    [`${money(E.prize)} to the winner`, "Cash to the team that wins it all, and the winners are highlighted as the best players in the whole DMV."],
  ];

  const steps: [string, string][] = [
    ["Lock your spot", "Registration is payment. Your team is in the moment the entry fee is paid."],
    ["Send your roster", `Team name, captain and players. Then follow ${E.handle} on Instagram, that is where the schedule drops.`],
    ["Show up and win it", `${E.shortDate} at ${E.venue}. ${money(E.prize)} goes to the winning team.`],
  ];

  const questions: [string, string][] = [
    ["How many teams get in?", `${E.teams}. When ${E.teams} teams have paid, registration closes.`],
    ["Is the price per player?", `No, per team. ${money(E.earlyBird)} for the whole team through ${earlyLast}, ${money(E.standard)} from ${standardFrom}.`],
    ["When is the last day to register?", `${finalDay}. Every team pays in full by then, or sooner if all ${E.teams} spots are taken.`],
    ["Is my spot held if I sign up and pay later?", "No. A spot is held only once the entry fee is paid."],
    ["When do we get the schedule?", `We announce the schedule and the social media rollout a week before the event, on Instagram. Follow ${E.handle} so your team does not miss it.`],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <MetaPixel id={META_PIXEL_ID} />

      {/* Hero: the event poster (marketing/graphics/strive-elite-collage,
          exported to public/events). It carries the date, the venue and
          the prize, so the h1 is for screen readers and search only. */}
      <h1 className="sr-only">
        {E.name}, {money(E.prize)} cash prize, {E.dateLabel} at {E.venue}
      </h1>
      <div className="rise-in overflow-hidden rounded-2xl border border-white/8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/events/strive-elite-5v5.jpg"
          width={1080}
          height={1350}
          alt={`${E.name}. ${money(E.prize)} cash prize. ${E.shortDate} at ${E.venue}.`}
          className="block h-auto w-full"
        />
      </div>
      <p className="mx-auto mt-6 max-w-md text-center text-sm leading-relaxed text-white/60">
        The most competitive players in the DMV, {E.teams} teams, one day. Maryland or Virginia, who really runs the DMV?
      </p>

      {/* Price + register */}
      <Reveal variant="build" className="mt-9 rounded-2xl border border-accent/30 bg-accent/[0.06] p-5 text-center">
        {phase === "closed" || price === null || !target ? (
          <div className="font-display text-xl font-bold">Registration is closed.</div>
        ) : (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
              {phase === "early" ? "Early bird" : "Team entry"}
            </div>
            <div className="mt-1 font-display text-4xl font-black">
              {money(price)}
              <span className="text-base font-semibold text-white/60"> per team</span>
            </div>
            <div className="mx-auto mt-3 h-px w-16 bg-accent/70" />
            <p className="mt-3 text-sm text-white/65">
              {phase === "early"
                ? `Early bird ends ${earlyLast} at midnight. ${money(E.standard)} per team from ${standardFrom}. Final deadline ${finalDay}.`
                : `Early bird has ended. Final deadline ${finalDay}, or sooner if all ${E.teams} spots are taken.`}
            </p>
            <a
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block w-full rounded-full bg-accent px-6 py-3.5 font-display text-lg font-black uppercase tracking-wider text-black transition-opacity hover:opacity-90 sm:w-auto"
            >
              {target.kind === "form" ? "Register your team" : `DM “${E.dmWord}” to register`}
            </a>
            {target.kind === "form" && (
              <p className="mt-2 text-xs text-white/45">Opens the registration form. Your spot is held once the {money(price)} entry fee is paid.</p>
            )}
            {target.kind === "dm" && (
              <p className="mt-2 text-xs text-white/45">Opens Instagram. Send “{E.dmWord}” and we reply with the registration form.</p>
            )}
          </>
        )}
      </Reveal>

      {/* What every team gets */}
      <h2 className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">Every team gets</h2>
      <div className="grid grid-cols-2 gap-2">
        {included.map(([title, body], i) => (
          <Reveal key={title} variant="build" delay={i * 80} className="rounded-2xl border border-accent/15 bg-accent/[0.03] p-4">
            <div className="font-display text-sm font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{body}</p>
          </Reveal>
        ))}
      </div>

      {/* How it works */}
      <h2 className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">How it works</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map(([title, body], i) => (
          <Reveal key={title} variant="build" delay={i * 90} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-xs font-bold text-accent">0{i + 1}</div>
            <div className="mt-1 font-display text-sm font-bold">{title}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{body}</p>
          </Reveal>
        ))}
      </div>

      {/* Questions */}
      <h2 className="mb-2.5 mt-9 font-display text-sm font-bold uppercase tracking-wider text-white/50">Questions</h2>
      <div className="space-y-2">
        {questions.map(([q, a], i) => (
          <Reveal key={q} variant="build" delay={i * 80} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
            <div className="font-display text-sm font-bold">{q}</div>
            <p className="mt-1 text-xs leading-relaxed text-white/50">{a}</p>
          </Reveal>
        ))}
      </div>

      {/* Follow */}
      <Reveal variant="build" className="mt-9 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
        <div className="font-display text-lg font-bold">The schedule drops on Instagram</div>
        <p className="mt-1 text-sm text-white/55">
          Schedule and social media rollout a week before the event. Follow us so your team sees it first.
        </p>
        <a
          href={E.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full border border-accent/60 px-6 py-3 font-display text-base font-bold uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-black"
        >
          Follow {E.handle}
        </a>
      </Reveal>

      <p className="mt-10 text-center text-xs text-white/35">
        Strive Soccer <span className="mx-1.5">•</span>{" "}
        <a href={E.instagram} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-white/70 hover:underline">
          {E.handle}
        </a>
      </p>
    </div>
  );
}
