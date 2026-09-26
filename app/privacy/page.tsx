import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";

export const metadata = { title: "Privacy Policy · Strive Elite" };

const UPDATED = "September 26, 2026";
const CONTACT_EMAIL = "coach@strivesoccer100x.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6">
        <Wordmark href="/" />
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-white/40">Last updated {UPDATED}</p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-white/75">
          <p>
            Strive Elite (&quot;Strive,&quot; &quot;we,&quot; &quot;us&quot;) is a youth soccer
            training program run by Coach Yinka at Strive Soccer FC. This
            page explains what information we collect through the app at
            thestriveapp.com, why we collect it, and how it&apos;s used.
            Strive Elite accounts are set up by a parent or guardian on
            behalf of a player, so this policy is written for you, the
            parent or guardian.
          </p>

          <Section title="Information we collect">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-bone">Player information:</strong>{" "}
                name, age, position, playing level, club, dominant foot, and
                gender.
              </li>
              <li>
                <strong className="text-bone">Parent/guardian contact info:</strong>{" "}
                name, email address, and phone number, used to send you
                updates about your player&apos;s training.
              </li>
              <li>
                <strong className="text-bone">Training data:</strong> weekly
                homework completion, self-reported check-ins (energy,
                rating, notes), progress ratings, and links to any film you
                or your player submit (we store the link, e.g. to Hudl or
                YouTube - we don&apos;t host the video file itself).
              </li>
              <li>
                <strong className="text-bone">Messages:</strong> any message
                sent between you, your player, and the coach inside the app
                or by text.
              </li>
              <li>
                <strong className="text-bone">Account and technical data:</strong>{" "}
                your login email, a securely hashed password (we never see
                or store your actual password), and, if you enable push
                notifications, the technical subscription details needed to
                send them.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <p>
              We use this information to build and run your player&apos;s
              training program: generating and adjusting their weekly plan,
              tracking progress over time, sending you training updates and
              your weekly parent report, and letting you and the coach
              message each other. Coach Yinka directs and reviews the
              program for every player. Some parts of building a weekly
              plan and writing your weekly update are assisted by automated
              software tools under his direction, the same way a coach
              might use any software tool to help manage a large roster -
              we&apos;re telling you this here because it&apos;s the honest,
              accurate answer to &quot;how does this actually work,&quot;
              even though we&apos;d rather talk to you about your kid&apos;s
              training than about our tech stack.
            </p>
            <p>
              We never sell your or your player&apos;s information to
              anyone, for any reason.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>
              We use a small number of outside services to run the app,
              and only share what each one needs to do its job:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-bone">Supabase</strong> stores our
                database (everything listed above) and handles login.
              </li>
              <li>
                <strong className="text-bone">GoHighLevel</strong> sends
                text messages on our behalf and, separately, is our CRM for
                sales and scheduling conversations before you join.
              </li>
              <li>
                <strong className="text-bone">Anthropic</strong> (Claude)
                provides the automated tools mentioned above that assist in
                drafting parts of a weekly plan or update, under Coach
                Yinka&apos;s review.
              </li>
              <li>
                <strong className="text-bone">Resend</strong>, if enabled,
                sends transactional emails.
              </li>
              <li>
                <strong className="text-bone">Stripe</strong>, for anyone
                who pays by card, processes that payment - we don&apos;t see
                or store your card number.
              </li>
            </ul>
          </Section>

          <Section title="Children's information">
            <p>
              Strive Elite is a program for youth players, most of whom are
              under 13. Accounts are created and controlled by a parent or
              guardian, not the child, and all communications about the
              program go to the parent/guardian contact info on file. If
              you have questions about your child&apos;s information, or
              want it corrected or removed, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You can ask us at any time to see what information we have on
              file for your player, correct anything that&apos;s wrong, or
              delete your account. Deleting an account removes the
              player&apos;s training history, messages, and progress data.
              We keep information only as long as your player is an active
              member, plus a reasonable period afterward for our own
              records, unless you ask us to delete it sooner.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use industry-standard practices (encrypted connections,
              access controls on our database) to protect your
              information, but no system is perfectly secure. If we ever
              become aware of a breach affecting your data, we&apos;ll let
              you know.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If this policy changes in a meaningful way, we&apos;ll update
              the date at the top of this page and, for significant
              changes, let current families know directly.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about privacy, or a request about your data?
              Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-white/8 pt-6 text-sm text-white/40">
          <Link href="/terms" className="hover:text-white">
            Terms of Service
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
