"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";
import { setNewPassword } from "@/lib/elite/auth-actions";
import { PASSWORD_MIN } from "@/lib/elite/account";

// Sets a new password for the recovery session established by
// /auth/confirm (or /auth/callback). The page checks on the server whether
// that session is there (hasSession) and the form posts to a server
// action, so the new session cookie is one the server sets
// (lib/elite/sign-in.ts). If no session is present (expired or reused
// link), the person is pointed back to /forgot for a fresh one.
export function ResetForm({ hasSession }: { hasSession: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, action] = useFormState(setNewPassword, { error: null });

  if (!hasSession) {
    return (
      <div className="elite-card p-7 text-center sm:p-8">
        <h1 className="font-display text-2xl font-black uppercase tracking-tight">
          That link has expired
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Reset links are single-use. Request a fresh one, then open it on
          the same phone and in the same browser you asked from.
        </p>
        <Link href="/forgot" className="btn-accent mt-6 inline-flex px-6 py-3">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">
        Set a new password
      </h1>
      <p className="mt-1.5 text-sm text-white/50">
        You&apos;re verified. Choose a new password for your account.
      </p>

      <form action={action} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Lock className="h-4 w-4" /> New password
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={`At least ${PASSWORD_MIN} characters`}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium text-white/70">
            <Lock className="h-4 w-4" /> Confirm it
          </span>
          <input
            type="password"
            name="confirm"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Same password again"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-bone placeholder:text-white/30 focus:border-accent/40 focus:outline-none"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-red-400">
            {state.error}
          </p>
        )}

        <SaveButton />
      </form>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Saving your new password" : undefined}
      className="btn-accent w-full px-6 py-3.5 text-base"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save new password"}
    </button>
  );
}
