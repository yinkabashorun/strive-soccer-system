"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { GUARDIAN_STATEMENT } from "@/lib/elite/legal";
import { FREE_AGREEMENT_POINTS, FREE_HOME } from "@/lib/elite/tracker";

// The four typed fields are kept for this tab only, so reading the Terms
// and coming back does not empty the form. The password is never kept.
const DRAFT_KEY = "strive_join_draft";
type Draft = { firstName: string; lastName: string; email: string; phone: string };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

// Create a free account: the training log (migration 069). The server
// creates the account and signs the person in; this form only collects
// the fields and the two ticked boxes.
export function JoinForm({ referral }: { referral: string }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = readDraft();
    if (!d) return;
    setFirstName(d.firstName ?? "");
    setLastName(d.lastName ?? "");
    setEmail(d.email ?? "");
    setPhone(d.phone ?? "");
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ firstName, lastName, email, phone }));
    } catch {
      // a private window with storage off: the form still works
    }
  }, [firstName, lastName, email, phone]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let res: Response;
    try {
      res = await fetch("/api/elite/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          password,
          ref: referral,
          agreed: { guardian, terms },
        }),
      });
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // nothing to clear
    }
    // A full page load, so the session cookie the server just set is used.
    window.location.assign(data.signedIn ? data.next || FREE_HOME : "/login");
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Start your training log
      </h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">
        Log the training you do on your own, watch your week add up, and share it.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" />
          <Input label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="username"
        />
        <Input
          label="Phone, so a coach can reach you"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="(703) 555-0100"
          autoComplete="tel"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <ul className="space-y-2">
            {FREE_AGREEMENT_POINTS.map((line) => (
              <li key={line} className="flex gap-2.5 text-[13px] leading-relaxed text-white/60">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {line}
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
              <Link href="/terms" className="tap underline underline-offset-2">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="tap underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        <button type="submit" disabled={loading} className="btn-accent w-full px-6 py-3.5 text-base">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create my account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-white/60">
        Already have an account?{" "}
        <Link href="/login" className="tap text-accent hover:underline">
          Sign in
        </Link>
      </p>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
      />
    </label>
  );
}
