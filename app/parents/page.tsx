import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";
import { SUPPORT_EMAIL, concernMailto } from "@/lib/elite/support";
import { PRO_PRICE_LINE, PRO_PRODUCT_NAME } from "@/lib/elite/pro";
import { PARENT_SEND } from "@/lib/elite/parent-link";
import { FREE_MIN_AGE } from "@/lib/elite/tracker";
import { TOPIC_CHOICE } from "@/lib/elite/notices";

export const metadata = { title: "For parents · Strive Elite" };

// Public page for a player's parent or guardian: what the app is, who sees
// what, what is not in it, and how to pay, report, delete and reach us.
// Every line is true of the app as built (checked against the code Nov 26
// 2026); the price comes from the one constant in lib/elite/pro.ts and the
// report promise is the Terms' own words. Linked from /support and from the
// free sign-up's agreement points. tests/parents-page.test.ts.
export default function ParentsPage() {
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6">
        <Wordmark href="/" />
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">For parents</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          What your player sees and shares in Strive Elite, and what you can do about it.
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-white/80">
          <Section title="What Strive Elite is">
            <p>
              A free app where your player times their own training: a start photo when they begin and a
              finish photo when they are done, both taken in the app. They share it with the friends they
              accepted, and see a weekly board with those friends and with their clubs.
            </p>
            <p className="mt-2">
              {PRO_PRODUCT_NAME} is the paid option. It adds a training plan every week, built around what
              your player told us, with a video for every drill.
            </p>
          </Section>

          <Section title="Who can see your player's training">
            <p>
              Only the friends your player accepted, the members of a club your player joined, and our
              coaches. Never the public. There is no public profile, and nobody can search for or browse
              players.
            </p>
            <p className="mt-2">
              Friends see your player&apos;s first name, last initial, profile photo, training time and the
              photos they post.
            </p>
          </Section>

          <Section title="How friends are made">
            <p>
              A friend is someone who sent your player a request that your player accepted. A club&apos;s
              captain decides who gets in, and joining a club makes your player friends with the players in
              it. Your player can remove a friend or block a player at any time. A block hides the two of
              them from each other.
            </p>
          </Section>

          <Section title="What is not in the app">
            <ul className="list-disc space-y-1 pl-5">
              <li>No direct messages between players.</li>
              <li>No comments. Friends can only give props on a post.</li>
              <li>The app never reads or shares your player&apos;s location.</li>
              <li>No ads.</li>
              <li>The app never asks for your phone&apos;s contacts.</li>
              <li>The two photos of a timed training are taken in the app&apos;s camera, at the time.</li>
            </ul>
            <p className="mt-2">
              A club&apos;s captain can plan a club session or a game and type where it is. Only the clubs
              involved see it. Strive does not run or supervise those, so please know where and when your
              player is playing.
            </p>
          </Section>

          <Section title="Age">
            <p>
              The free app is for players {FREE_MIN_AGE} and older. A player under {FREE_MIN_AGE} can use
              Strive Elite only through a membership a parent or guardian sets up and agrees to, and that
              account has no friends side.
            </p>
          </Section>

          <Section title="Reporting">
            <p>
              Every post, profile photo and club name can be reported in the app, and reports go to our
              coaches. In our{" "}
              <Link href="/terms" className="tap text-accent hover:underline">
                Terms of Service
              </Link>
              : &ldquo;We have zero tolerance for objectionable content and for abusive players: we look at
              every report within 24 hours, remove what breaks these terms, and close the account that posted
              it.&rdquo;
            </p>
            <p className="mt-2">
              Anything else that worries you,{" "}
              <a href={concernMailto("")} className="tap text-accent hover:underline">
                tell us
              </a>
              .
            </p>
          </Section>

          <Section title="Notifications">
            <p>The app can send your player notifications about:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {(Object.keys(TOPIC_CHOICE) as (keyof typeof TOPIC_CHOICE)[]).map((k) => (
                <li key={k}>
                  <span className="text-bone">{TOPIC_CHOICE[k].label}:</span> {TOPIC_CHOICE[k].detail}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Each kind can be switched off in the app&apos;s Settings, and the phone asks before any
              notification is allowed at all.
            </p>
          </Section>

          <Section title="Paying">
            <p>
              The free app costs nothing. {PRO_PRODUCT_NAME} is {PRO_PRICE_LINE}, and you can cancel any time
              from Account on the website.
            </p>
            <p className="mt-2">
              Your player can tap <strong className="text-bone">{PARENT_SEND}</strong> in the app and send
              you a link. It opens a page for you, where you agree to the terms as their parent or guardian
              and pay, so your player never needs your card.
            </p>
          </Section>

          <Section title="Deleting the account">
            <p>
              In the app open Settings, then <strong className="text-bone">Delete my account</strong>. It asks
              for the password and deletes everything right away: the login, the profile, the training
              history and every photo and video. A {PRO_PRODUCT_NAME} card is not charged again once the
              account is deleted.{" "}
              <Link href="/support#delete" className="tap text-accent hover:underline">
                More on deleting
              </Link>
              .
            </p>
          </Section>

          <Section title="How to reach us">
            <p>
              Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="tap text-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-white/8 pt-6 text-sm text-white/50">
          <Link href="/support" className="tap hover:text-white">
            Support
          </Link>
          <Link href="/privacy" className="tap hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="tap hover:text-white">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold uppercase text-bone">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
