"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cancelMyPro } from "@/lib/elite/pro-actions";

// "Cancel Strive Pro" on the Account page (074). Asks once, then stops
// the charges; the membership runs to the end of the month already paid.
export function CancelProForm() {
  const [state, action] = useFormState(cancelMyPro, { done: false, error: null, endsAt: null });
  const [asking, setAsking] = useState(false);

  if (state.done) {
    const ends = state.endsAt
      ? new Date(state.endsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" })
      : null;
    return (
      <p role="status" className="p-4 text-[15px] leading-relaxed text-white/75">
        Cancelled. You will not be charged again.
        {ends ? ` Your membership stays on until ${ends}.` : " Your membership stays on until the end of the month you paid for."}
      </p>
    );
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="flex min-h-[56px] w-full items-center p-4 text-left text-[15px] font-semibold text-bone"
      >
        Cancel Strive Pro
      </button>
    );
  }

  return (
    <form action={action} className="space-y-3 p-4">
      <p className="text-[15px] leading-relaxed text-white/75">
        You will not be charged again, and your membership stays on until the end of the month you
        paid for. Everything you trained stays saved.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-300">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="flex h-12 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
        >
          Keep it
        </button>
        <CancelButton />
      </div>
    </form>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={pending ? "Cancelling" : undefined}
      className="flex h-12 items-center justify-center rounded-2xl border border-red-300/40 text-[15px] font-semibold text-red-200"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel it"}
    </button>
  );
}
