"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isNativeUserAgent, linkPlan, type LinkPlan } from "@/lib/elite/app-links";
import { isNativeApp } from "@/lib/elite/native";

// THE link for anything a member taps that opens a new tab on the
// website: the Terms and Privacy pages, a family's own clip, a film link,
// a course download, a Zoom call. This is the only member-facing file
// allowed to ask for a new window (tests/app-links.test.ts holds that).
//
// On the website it is the plain link it always was. Inside the App Store
// app a new window means Safari, so the one rule in lib/elite/app-links.ts
// decides instead: a page of ours, a video or a playable film link opens
// in a sheet over the screen, with Close to come back to exactly where the
// member was (ticked boxes and typed fields untouched); a Zoom call still
// opens Zoom; anything else opens in the same view.

function inAppView(): boolean {
  if (typeof navigator === "undefined") return false;
  return isNativeApp() || isNativeUserAgent(navigator.userAgent);
}

export function AppLink({
  href,
  title,
  media,
  className,
  children,
}: {
  href: string;
  // The heading of the sheet, and its name for a screen reader.
  title: string;
  // "video": this address is a video file, whatever it is called.
  media?: "video";
  className?: string;
  children: ReactNode;
}) {
  const plan = linkPlan(href, { media });
  const [inApp, setInApp] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // Known only in the browser; the first paint is the website's link.
  useEffect(() => setInApp(inAppView()), []);

  // Not an address we open (empty, or not https): the words, no link.
  if (plan.kind === "none") return <span className={className}>{children}</span>;

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!inAppView()) return; // the website: nothing changes
    if (plan.inApp === "sheet") {
      e.preventDefault();
      setOpen(true);
    } else if (plan.inApp === "same_view") {
      e.preventDefault();
      window.location.assign(href);
    }
    // "leave": a call or an email, the phone takes it
  }

  const newWindow = plan.webNewTab && !(inApp && plan.inApp !== "leave");
  return (
    <>
      <a
        href={href}
        {...(newWindow ? { target: "_blank", rel: "noreferrer" } : {})}
        onClick={onClick}
        className={className}
      >
        {children}
      </a>
      {open && <Sheet plan={plan} href={href} title={title} onClose={close} />}
    </>
  );
}

// The sheet: the whole screen, a title, Close, and the page or the video.
function Sheet({
  plan,
  href,
  title,
  onClose,
}: {
  plan: LinkPlan;
  href: string;
  title: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!plan.sheetSrc) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[100] flex flex-col bg-black text-bone"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 pb-1.5 pl-5 pr-2 pt-[calc(0.375rem+env(safe-area-inset-top))]">
        <div className="min-w-0 truncate font-display text-lg font-bold uppercase tracking-tight">{title}</div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-bone"
        >
          <X className="h-4 w-4" /> Close
        </button>
      </div>

      {plan.kind === "video" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center pb-[env(safe-area-inset-bottom)]">
          <video
            src={plan.sheetSrc}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full w-full"
          />
        </div>
      ) : (
        <iframe
          src={plan.sheetSrc}
          title={title}
          allow={plan.kind === "embed" ? "autoplay; encrypted-media; picture-in-picture; fullscreen" : undefined}
          allowFullScreen={plan.kind === "embed"}
          className="min-h-0 w-full flex-1 border-0 bg-black"
        />
      )}

      {plan.kind === "embed" && (
        <p className="shrink-0 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-center text-[13px] text-white/60">
          Not playing here?{" "}
          <a href={href} target="_blank" rel="noreferrer" className="tap font-semibold text-bone underline underline-offset-4">
            Open it in your browser
          </a>
          .
        </p>
      )}
    </div>,
    document.body
  );
}
