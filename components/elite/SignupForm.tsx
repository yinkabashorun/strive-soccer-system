"use client";

import { useState } from "react";
import { AGREEMENT_POINTS, GUARDIAN_STATEMENT } from "@/lib/elite/legal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { enterDemoPlayer, enterDemoCoach } from "@/lib/elite/auth-actions";
import { signupLanding, type InviteRole } from "@/lib/elite/invite-link";

// Signup gated by a single-use invite code. A player code (the default)
// creates a family's account; a coach code (054, admin-generated) creates a
// coach, with no public path to one: the code's role comes from the server
// and the redeem route enforces it, this form only shapes the fields. An
// invite LINK (/signup?code=…) prefills the code so people just fill in
// name/email/password.
export function SignupForm({
  configured,
  initialCode = "",
  inviteRole = "player",
}: {
  configured: boolean;
  initialCode?: string;
  inviteRole?: InviteRole;
}) {
  const router = useRouter();
  const coach = inviteRole === "coach";
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [playerPhone, setPlayerPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeUsed, setCodeUsed] = useState(false);
  // The agreement: ticked by the person, never by default (068).
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCodeUsed(false);
    if (!configured) {
      setError("Sign-up isn't configured yet. Try a demo account below.");
      return;
    }
    setLoading(true);

    // 1) redeem the invite code + create a provisioned, active account
    const res = await fetch("/api/elite/auth/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        fullName,
        email,
        phone,
        playerPhone,
        password,
        // a coach is an adult signing for themselves: one box
        agreed: { guardian: coach ? true : guardian, terms },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      setCodeUsed(data.reason === "used");
      setLoading(false);
      return;
    }

    // 2) the redeem route signed the new account in on the server, so the
    // session cookie is one the server set (lib/elite/sign-in.ts). If that
    // one step failed the account still exists: send them to sign in.
    if (!data.signedIn) {
      setError("Account created. Please sign in.");
      setLoading(false);
      router.push("/login");
      return;
    }
    router.push(signupLanding(data.role === "coach" ? "coach" : "player"));
    router.refresh();
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <div className="chip-accent mb-3 inline-flex">
        <KeyRound className="h-3.5 w-3.5" /> {coach ? "Coach invite" : "Invite only"}
      </div>
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        {coach ? "Create your coach account" : "Activate your membership"}
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        {coach
          ? "This invite creates a coach login for Strive Elite: the roster, every player's week, the drill bank and the courses."
          : "Enter the invite code your coach sent you to create your Strive Elite account."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Invite code"
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          placeholder="STRIVE-XXXXXX"
          autoComplete="off"
        />
        <Input
          label={coach ? "Your name" : "Player name"}
          value={fullName}
          onChange={setFullName}
          placeholder={coach ? "Your full name" : "Player's full name"}
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        {!coach && (
          <>
            <Input
              label="Parent phone (for text updates)"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="(703) 555-0100"
              autoComplete="tel"
            />
            <Input
              label="Player's own phone (optional, for Film Room and call texts)"
              type="tel"
              value={playerPhone}
              onChange={setPlayerPhone}
              placeholder="(703) 555-0100"
              autoComplete="tel"
              required={false}
            />
          </>
        )}
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-red-400">
            {error}
            {codeUsed && (
              <>
                {" "}
                <Link href="/login" className="tap font-semibold text-accent underline-offset-2 hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        )}

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {!coach && (
            <>
              <ul className="space-y-2">
                {AGREEMENT_POINTS.map((point) => (
                  <li key={point} className="flex gap-2.5 text-[13px] leading-relaxed text-white/60">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {point}
                  </li>
                ))}
              </ul>
              <label className="flex min-h-[44px] items-start gap-3 py-1 text-sm leading-snug text-bone">
                <input
                  type="checkbox"
                  required
                  checked={guardian}
                  onChange={(e) => setGuardian(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-white"
                />
                <span>{GUARDIAN_STATEMENT}</span>
              </label>
            </>
          )}
          <label className="flex min-h-[44px] items-start gap-3 py-1 text-sm leading-snug text-bone">
            <input
              type="checkbox"
              required
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-white"
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="tap underline underline-offset-2">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="tap underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-accent w-full px-6 py-3.5 text-base"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            coach ? "Create my coach account" : "Create my account"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href="/login" className="tap text-accent hover:underline">
          Sign in
        </Link>
      </p>
      {!coach && (
        <p className="mt-2 text-center text-[13px] text-white/50">
          Don&apos;t have a code?{" "}
          <a
            href="https://strivesoccer100x.com"
            className="tap text-white/60 hover:text-accent"
          >
            Apply to join
          </a>
        </p>
      )}
      {!configured && (
        <div className="mt-7 border-t border-white/8 pt-6">
          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Explore the demo
          </div>
          <div className="grid grid-cols-2 gap-3">
            <form action={enterDemoPlayer}>
              <button className="btn w-full py-3">Enter as Player</button>
            </form>
            <form action={enterDemoCoach}>
              <button className="btn w-full py-3">Enter as Coach</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/70">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
      />
    </label>
  );
}
