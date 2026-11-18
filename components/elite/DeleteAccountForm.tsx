"use client";

import { useFormState, useFormStatus } from "react-dom";
import { deleteMyAccount } from "@/lib/elite/account-actions";

// The last step of "Delete my account": the password, one red button.
export function DeleteAccountForm() {
  const [state, action] = useFormState(deleteMyAccount, { error: null });
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-bone">Your password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-bone outline-none focus:border-white/40"
        />
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
      className="flex h-14 w-full items-center justify-center rounded-2xl bg-red-500 font-display text-xl font-black uppercase tracking-wide text-white disabled:opacity-60"
    >
      {pending ? "Deleting..." : "Delete my account for good"}
    </button>
  );
}
