import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";
import { SHEET_PARAM, shownInSheet } from "@/lib/elite/app-links";

export const metadata = { title: "Terms of Service · Strive Elite" };

const UPDATED = "November 18, 2026";
const CONTACT_EMAIL = "coach@strivesoccer100x.com";

export default function TermsPage({
  searchParams,
}: {
  searchParams?: { [SHEET_PARAM]?: string | string[] };
}) {
  // Inside the iPhone app this page opens in a sheet over the screen the
  // person was on (components/elite/AppLink.tsx). There it carries no
  // link that would walk the sheet off to another part of the app.
  const sheet = shownInSheet(searchParams?.[SHEET_PARAM]);
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div
        className={
          sheet
            ? "mx-auto w-full max-w-2xl px-5 pb-10 pt-6 sm:px-6"
            : "mx-auto w-full max-w-2xl px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6"
        }
      >
        <Wordmark href={sheet ? null : "/"} />
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-white/50">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-white/75">
          <p>
            These terms cover your use of Strive Elite (the app at
            thestriveapp.com) and the training program it supports. By
            creating an account, a parent or guardian agrees to these
            terms on behalf of their player.
          </p>

          <Section title="Who can join">
            <p>
              Strive Elite accounts are invite-only and are created by a
              parent or legal guardian on behalf of a youth player, or by
              a player who is 18 or older. The account holder (the adult)
              is responsible for the accuracy of the information provided
              and for their player&apos;s use of the app. A player under
              13 uses Strive Elite only through an account their parent or
              guardian created and agreed to.
            </p>
            <p className="mt-3">
              When the account is created the adult ticks a box to accept
              these terms and our Privacy Policy, and we keep a record of
              that. If the terms change in a way that matters, the app
              asks the adult to accept them again before training goes on.
            </p>
            <p className="mt-3">
              A free account is a training log only: a place to record the
              training a player does on their own. It has no coaching plan,
              no drills and no courses, and when free sign-up is open it is
              created without an invite. Everything else in these terms
              applies to it the same way.
            </p>
          </Section>

          <Section title="The program">
            <p>
              Strive Elite provides a weekly training plan, progress
              tracking, film review, and direct communication with Coach
              Yinka, based on the membership tier purchased. Coach Yinka
              builds and reviews every player&apos;s program; the specific
              tools and schedule used to do that may change over time.
            </p>
          </Section>

          <Section title="Payment and billing">
            <p>
              Membership pricing and billing are handled directly with
              Coach Yinka or through our booking system, separate from this
              app. Refunds are handled the same day, in good faith, if
              something isn&apos;t right - reach out and we&apos;ll sort it
              out.
            </p>
          </Section>

          <Section title="Physical activity and assumption of risk">
            <p>
              Soccer training involves physical activity and carries an
              inherent risk of injury. By participating in Strive Elite,
              in-person or through the app&apos;s at-home training program,
              you acknowledge that risk on behalf of your player. Follow
              any safety guidance given for at-home sessions (appropriate
              space, footwear, and supervision as needed for the
              player&apos;s age).
            </p>
          </Section>

          <Section title="Not medical advice">
            <p>
              Training plans, strength and speed work, and the General
              Nutrition Guide are general guidance for healthy youth
              players. None of it is medical advice, and none of it
              replaces a doctor, a physical therapist or an athletic
              trainer. A player who is injured or returning from injury
              trains only as far as their doctor or physical therapist has
              cleared them, and tells their coach what those limits are.
            </p>
          </Section>

          <Section title="Clips and messages">
            <p>
              Clips, photos and messages you send through the app stay
              yours. By sending them you allow us to store them and to
              view them so we can coach your player. They are seen
              by the Strive coaches. Clips you add to a Film Room are
              watched in that session by the members who join it. We do
              not post a
              player&apos;s clip publicly unless a parent or guardian has
              said yes to that clip. Send only clips of your own player,
              and nothing unlawful, abusive or unrelated to training. To
              report something that concerns you, use Report a concern on
              the Account page or email us.
            </p>
          </Section>

          <Section title="Texts and notifications">
            <p>
              We text the phone numbers you give us about your
              player&apos;s training: a new week, a message from a coach,
              a Film Room or a call. Message and data rates may apply.
              Reply STOP to any text to end them. Push notifications are
              optional and can be turned on or off on the Account page.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              The app is for your player&apos;s training and your family&apos;s
              communication with the coach. Don&apos;t share your invite
              code or account access outside your family, attempt to
              access another player&apos;s data, or use the app or its
              messaging features for anything abusive or unrelated to the
              program.
            </p>
          </Section>

          <Section title="Cancellation">
            <p>
              You can stop your membership at any time by contacting Coach
              Yinka directly. Your account and training history stay
              intact unless you separately request deletion (see our{" "}
              <Link href={sheet ? `/privacy?${SHEET_PARAM}=1` : "/privacy"} className="tap text-accent hover:underline">
                Privacy Policy
              </Link>
              ).
            </p>
          </Section>

          <Section title="Deleting your account">
            <p>
              You can delete your account yourself at any time: open the
              app, go to Account, then Delete my account. What is removed
              and what we must keep is set out in our Privacy Policy.
              Deleting the account does not by itself stop a membership
              that is billed outside the app, so tell your coach too.
            </p>
          </Section>

          <Section title="The iPhone app">
            <p>
              If you use Strive Elite through the app from Apple&apos;s App
              Store, these terms are between you and Strive Elite, not
              Apple. Apple is not responsible for the app, its content or
              its support. No purchase is made inside the app.
            </p>
          </Section>

          <Section title="No guarantee of results">
            <p>
              Every player develops at their own pace. We&apos;re
              committed to real, honest coaching and programming, but we
              can&apos;t guarantee specific outcomes, playing time, or
              results from the program.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              Strive Elite and Coach Yinka are not liable for indirect,
              incidental, or consequential damages arising from use of the
              app or participation in the training program, to the fullest
              extent permitted by law.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms as the program evolves. When a
              change matters to your family, the app asks the account
              holder to accept the new terms before training continues.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="tap text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-white/8 pt-6 text-sm text-white/50">
          <Link href={sheet ? `/privacy?${SHEET_PARAM}=1` : "/privacy"} className="tap hover:text-white">
            Privacy Policy
          </Link>
          {!sheet && (
            <Link href="/login" className="tap hover:text-white">
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-tight text-bone">
        {title}
      </h2>
      {children}
    </section>
  );
}
