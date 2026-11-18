import Link from "next/link";
import { Wordmark } from "@/components/elite/Wordmark";
import { SUPPORT_EMAIL, concernMailto } from "@/lib/elite/support";

export const metadata = { title: "Support · Strive Elite" };

// Public support page: how to reach us, how to delete an account (also the
// web address the app stores ask for), how to report a concern.
export default function SupportPage() {
  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6">
        <Wordmark href="/" />
        <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
          Support
        </h1>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-white/80">
          <section>
            <h2 className="font-display text-xl font-bold uppercase text-bone">Talk to us</h2>
            <p className="mt-2">
              Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="tap text-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>
              . Members can also message their coach inside the app, on the Coach tab.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold uppercase text-bone">Trouble signing in</h2>
            <p className="mt-2">
              On the sign-in page tap <strong className="text-bone">Forgot your password</strong>{" "}
              and open the email on the same phone. If that does not work, email us from the
              address on the account.
            </p>
          </section>

          <section id="delete">
            <h2 className="font-display text-xl font-bold uppercase text-bone">Delete your account</h2>
            <p className="mt-2">
              Sign in, open <strong className="text-bone">Account</strong> (tap your initials at
              the top of the app), then <strong className="text-bone">Delete my account</strong>.
              It asks for your password and deletes everything right away: the login, the
              player&apos;s profile, training history, messages and uploaded videos.
            </p>
            <p className="mt-2">
              Cannot sign in? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Delete my account")}`} className="tap text-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from the address on the account and we will delete it for you. Payment records
              are kept as long as tax and accounting rules require. The{" "}
              <Link href="/privacy" className="tap text-accent hover:underline">
                privacy policy
              </Link>{" "}
              has the details.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold uppercase text-bone">Report a concern</h2>
            <p className="mt-2">
              If anything in the app worries you, a message, a clip, anything at all,{" "}
              <a href={concernMailto("")} className="tap text-accent hover:underline">
                tell us
              </a>
              . We read every report and act on it.
            </p>
          </section>
        </div>

        <div className="mt-10 flex items-center gap-4 border-t border-white/8 pt-6 text-sm text-white/50">
          <Link href="/privacy" className="tap hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="tap hover:text-white">
            Terms of Service
          </Link>
          <Link href="/login" className="tap hover:text-white">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
