import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";

export const metadata = { title: "Terms of Service · Strive Elite" };

const UPDATED = "September 26, 2026";
const CONTACT_EMAIL = "coach@strivesoccer100x.com";

export default function TermsPage() {
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6">
        <Wordmark href="/" />
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-white/40">Last updated {UPDATED}</p>

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
              parent or guardian on behalf of a youth player. The account
              holder (the adult) is responsible for the accuracy of the
              information provided and for their player&apos;s use of the
              app.
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
              <Link href="/privacy" className="text-accent hover:underline">
                Privacy Policy
              </Link>
              ).
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
              We may update these terms as the program evolves. Continued
              use of the app after an update means you accept the revised
              terms. For significant changes, we&apos;ll let current
              families know directly.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-white/8 pt-6 text-sm text-white/40">
          <Link href="/privacy" className="hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/login" className="hover:text-white">
            Back to sign in
          </Link>
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
