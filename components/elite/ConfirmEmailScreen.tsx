"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CODE_LENGTH, CONFIRM_COPY, RESEND_SECONDS, cleanCode, type ConfirmAnswer } from "@/lib/elite/email-confirm";
import { changeMyEmail, confirmMyCode, sendMyCode } from "@/lib/elite/email-confirm-actions";
import { Wordmark } from "./Wordmark";

// "Check your email" (093), the website's screen. The same words and the
// same server functions as the iPhone app's screen (mobile/app/
// confirm-email.tsx). One box for the code, Confirm, Send a new code, and
// Wrong email? Change it. Once confirmed, the page refreshes and the front
// door takes the person on.
export function ConfirmEmailScreen({ email: first, signOut }: { email: string; signOut: () => Promise<void> }) {
  const router = useRouter();
  const [email, setEmail] = useState(first);
  const [code, setCode] = useState("");
  const [changing, setChanging] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [line, setLine] = useState<{ text: string; bad: boolean } | null>(null);
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function show(r: ConfirmAnswer, okText?: string) {
    if (r.email) setEmail(r.email);
    if (r.ok) {
      if (okText) setLine({ text: okText, bad: false });
      return true;
    }
    setLine({ text: r.error, bad: r.reason !== "expired" });
    if (r.waitSeconds) setWait(r.waitSeconds);
    else if (r.reason === "expired") setWait(RESEND_SECONDS);
    return false;
  }

  function confirm() {
    if (!cleanCode(code)) return setLine({ text: CONFIRM_COPY.badCode, bad: true });
    start(async () => {
      const r = await confirmMyCode(code);
      if (show(r, CONFIRM_COPY.done)) {
        router.replace("/");
        router.refresh();
      } else setCode("");
    });
  }

  function resend() {
    if (wait > 0) return setLine({ text: CONFIRM_COPY.resendWait(wait), bad: false });
    start(async () => {
      if (show(await sendMyCode(), CONFIRM_COPY.resent)) setWait(RESEND_SECONDS);
    });
  }

  function change() {
    start(async () => {
      if (show(await changeMyEmail(newEmail), CONFIRM_COPY.resent)) {
        setChanging(false);
        setNewEmail("");
        setCode("");
        setWait(RESEND_SECONDS);
      }
    });
  }

  const input =
    "h-14 w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-[16px] text-bone placeholder:text-white/30 focus:border-white/40 focus:outline-none";
  const button =
    "flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60 active:scale-[0.98]";

  return (
    <div className="min-h-[100svh] bg-black px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] text-bone">
      <div className="mx-auto max-w-md">
        <Wordmark href={null} size="lg" />
        {!changing ? (
          <>
            <h1 className="mt-8 font-display text-4xl font-black uppercase leading-[0.95]">{CONFIRM_COPY.title}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">{CONFIRM_COPY.body(email)}</p>
            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              <label htmlFor="code" className="mb-2 block text-[13px] text-white/60">
                {CONFIRM_COPY.field}
              </label>
              <input
                id="code"
                name="code"
                className={`${input} text-center font-display text-3xl tracking-[0.5em]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                autoFocus
              />
              {line && (
                <p role="status" className={`mt-4 text-[14px] ${line.bad ? "text-[#ff6b5e]" : "text-white/70"}`}>
                  {line.text}
                </p>
              )}
              <button type="submit" disabled={pending} className={`${button} mt-6`}>
                {pending ? "Checking" : CONFIRM_COPY.confirm}
              </button>
            </form>
            <div className="mt-5 flex flex-col items-center gap-1 text-[14px] text-white/70">
              <button type="button" onClick={resend} disabled={pending} className="tap min-h-11 underline-offset-4 hover:underline">
                {CONFIRM_COPY.resend}
              </button>
              {wait > 0 && <span className="text-[13px] text-white/45">{CONFIRM_COPY.resendWait(wait)}</span>}
              <button
                type="button"
                onClick={() => {
                  setChanging(true);
                  setLine(null);
                }}
                className="tap min-h-11 underline-offset-4 hover:underline"
              >
                {CONFIRM_COPY.changeLink}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-display text-4xl font-black uppercase leading-[0.95]">{CONFIRM_COPY.changeTitle}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">{CONFIRM_COPY.changeBody}</p>
            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                change();
              }}
            >
              <label htmlFor="email" className="mb-2 block text-[13px] text-white/60">
                {CONFIRM_COPY.changeField}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={input}
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoFocus
              />
              {line && (
                <p role="status" className={`mt-4 text-[14px] ${line.bad ? "text-[#ff6b5e]" : "text-white/70"}`}>
                  {line.text}
                </p>
              )}
              <button type="submit" disabled={pending} className={`${button} mt-6`}>
                {pending ? "Sending" : CONFIRM_COPY.changeButton}
              </button>
            </form>
            <div className="mt-5 flex justify-center text-[14px] text-white/70">
              <button
                type="button"
                onClick={() => {
                  setChanging(false);
                  setLine(null);
                }}
                className="tap min-h-11 underline-offset-4 hover:underline"
              >
                {CONFIRM_COPY.changeBack}
              </button>
            </div>
          </>
        )}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 text-[13px] text-white/50">
          <Link href="/account/delete" className="tap underline-offset-4 hover:underline">
            {CONFIRM_COPY.deleteAccount}
          </Link>
          <form action={signOut}>
            <button className="tap underline-offset-4 hover:underline">{CONFIRM_COPY.signOut}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
