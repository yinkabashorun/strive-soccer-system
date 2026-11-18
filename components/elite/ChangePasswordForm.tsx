"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { changeMyPassword } from "@/lib/elite/account-actions";
import { PASSWORD_CHANGED_MESSAGE, PASSWORD_MIN } from "@/lib/elite/account";

// "Change password" on the Account page: the current password, the new
// one, one button. The current password is checked on the server before
// anything changes (lib/elite/account-actions.ts).
export function ChangePasswordForm() {
  const [state, action] = useFormState(changeMyPassword, { error: null, done: false });

  if (state.done) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-black">
            <Check className="h-5 w-5" strokeWidth={3} />
          </span>
          <p role="status" className="text-[15px] leading-relaxed text-white/85">
            {PASSWORD_CHANGED_MESSAGE}
          </p>
        </div>
        <Link
          href="/account"
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black"
        >
          Back to Account
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-bone">Current password</span>
        <input
          type="password"
          name="current"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-bone outline-none focus:border-white/40"
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-bone">New password</span>
        <input
          type="password"
          name="next"
          required
          minLength={PASSWORD_MIN}
          autoComplete="new-password"
          aria-describedby="new-password-rule"
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-bone outline-none focus:border-white/40"
        />
        <span id="new-password-rule" className="mt-1.5 block text-[13px] text-white/60">
          At least {PASSWORD_MIN} characters.
        </span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/[0.07] p-3 text-sm text-red-200">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
    >
      {pending ? "Changing it" : "Change my password"}
    </button>
  );
}
