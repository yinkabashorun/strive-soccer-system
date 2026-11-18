import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";

export const metadata = { title: "Privacy Policy · Strive Elite" };

const UPDATED = "November 18, 2026";
const CONTACT_EMAIL = "coach@strivesoccer100x.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6">
        <Wordmark href="/" />
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-white/50">Last updated {UPDATED}</p>

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
                updates about your player&apos;s training. A player&apos;s
                own phone number is optional and only used for training
                texts if you add it.
              </li>
              <li>
                <strong className="text-bone">Training data:</strong> weekly
                homework completion, self-reported check-ins (energy,
                rating, notes), progress ratings, time trained, and links to
                any game film you or your player submit (e.g. to Hudl or
                YouTube).
              </li>
              <li>
                <strong className="text-bone">Videos your player uploads:</strong>{" "}
                clips of a drill sent to the coach, progress videos, and
                clips added for a Film Room session. These files are stored
                privately. Only your family and the coaches can open them.
                A clip is never posted publicly unless a parent or guardian
                has said yes to that specific clip.
              </li>
              <li>
                <strong className="text-bone">A free training log account:</strong>{" "}
                your name, email and phone number, the three answers you
                give when you set it up (playing level, in season or off
                season, and your goal), and each entry you log (the date,
                the minutes, and whether it was training or gym work).
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
                send them. If the app shows an error page, we record which
                page it was and what went wrong so we can fix it.
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
                database and uploaded videos (everything listed above) and
                handles login.
              </li>
              <li>
                <strong className="text-bone">Vercel</strong> hosts the app
                itself.
              </li>
              <li>
                <strong className="text-bone">Zoom</strong> hosts Film Room
                sessions and coaching calls. Joining one is subject to
                Zoom&apos;s own terms.
              </li>
              <li>
                <strong className="text-bone">Apple and Google</strong>{" "}
                deliver push notifications to your phone if you turn them
                on.
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

          <Section title="Your agreement and advertising">
            <p>
              When an account is created, and again if our terms change,
              the adult on the account accepts our Terms and this policy.
              We keep a record of that acceptance: the version, the date
              and time, the device&apos;s browser type, and the name typed
              if one was asked for.
            </p>
            <p className="mt-3">
              Our public information page (thestriveapp.com/demo) uses an
              advertising pixel from Meta to measure visits from our ads.
              It is not used anywhere inside the member app, and we do not
              use a player&apos;s training information for advertising.
            </p>
            <p className="mt-3">
              Clips you add to a weekly Film Room are watched in that
              session by the coaches and the members who join it. Every
              other clip is seen only by the coaches.
            </p>
          </Section>

          <Section title="Children's information">
            <p>
              Strive Elite is a training program for youth players, most of
              whom are between 12 and 15. Accounts are created and
              controlled by a parent or guardian, and a player under 13
              takes part only through an account their parent or guardian
              set up and agreed to. Communications about the program go to
              the parent/guardian contact info on file. We do not show
              advertising in the app and we do not use your player&apos;s
              information for advertising. If
              you have questions about your child&apos;s information, or
              want it corrected or removed, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="tap text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You can ask us at any time to see what information we have on
              file for your player or to correct anything that&apos;s wrong.
              You can turn push notifications off on the Account page in
              the app, and stop text messages by replying STOP to one or
              by asking us.
            </p>
          </Section>

          <Section title="Deleting your account">
            <p>
              You can delete your account yourself, at any time, inside the
              app: open <strong className="text-bone">Account</strong>, then{" "}
              <strong className="text-bone">Delete my account</strong>. You
              will be asked for your password to confirm. If you can&apos;t
              sign in, email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="tap text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              from the address on the account and we will delete it for
              you.
            </p>
            <p>
              Deleting an account is permanent and takes effect right away.
              It removes the login, the player&apos;s profile, training
              plans and history, progress data, messages, and every video
              the player uploaded. What it does not remove: records of
              payments, which are held by our payment processor and which we
              keep as long as tax and accounting rules require, and text
              messages already delivered to your phone. Backup copies held
              by our hosting provider are overwritten on their regular
              schedule. Deleting an account does not by itself stop a
              monthly payment. We are told when an account is deleted and
              stop the billing; you can also ask us directly.
            </p>
            <p>
              While an account is open we keep its information so the
              program can work. If a membership ends and the account is
              left open, you can delete it the same way or ask us to.
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
              <a href={`mailto:${CONTACT_EMAIL}`} className="tap text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-white/8 pt-6 text-sm text-white/50">
          <Link href="/terms" className="tap hover:text-white">
            Terms of Service
          </Link>
          <Link href="/login" className="tap hover:text-white">
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
