"use client";

import { useState, useTransition } from "react";
import { saveAppVersion } from "@/lib/elite/tracker-actions";

// Coach controls for the iPhone app's two settings
// (lib/elite/app-version.ts): the one link to the app (the TestFlight
// public link today, the App Store page later) and the oldest build that
// still works.
export function AppLinkAdmin({ link: initialLink, minBuild: initialMin }: { link: string | null; minBuild: number }) {
  const [link, setLink] = useState(initialLink ?? "");
  const [minBuild, setMinBuild] = useState(String(initialMin));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await saveAppVersion({ link, minBuild });
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  const field =
    "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[16px] text-bone focus:border-accent/40 focus:outline-none";

  return (
    <div className="elite-card mt-4 p-5">
      <div className="text-[15px] font-semibold text-bone">The iPhone app</div>
      <div className="mt-0.5 text-sm text-white/60">
        Paste the link players get the app from. An invite opened on an iPhone then points to the app, and an old build
        sends players here to update.
      </div>
      <label className="mt-4 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50" htmlFor="app-link">
        Link to the app
      </label>
      <input
        id="app-link"
        className={`mt-1.5 block w-full ${field}`}
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="https://testflight.apple.com/join/..."
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          setSaved(false);
        }}
      />
      <label className="mt-4 block text-[12px] font-semibold uppercase tracking-[0.12em] text-white/50" htmlFor="app-min-build">
        Oldest build that still works
      </label>
      <input
        id="app-min-build"
        className={`mt-1.5 block w-28 ${field}`}
        inputMode="numeric"
        value={minBuild}
        onChange={(e) => {
          setMinBuild(e.target.value);
          setSaved(false);
        }}
      />
      <div className="mt-1.5 text-sm text-white/60">
        A build under this number shows one screen: get the new version. Leave it at 0 to let every build work. Builds 9
        and older cannot read this number, so it only reaches build 10 and newer.
      </div>
      {error ? <div className="mt-3 text-sm text-red-400">{error}</div> : null}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="btn mt-4"
      >
        {pending ? "Saving" : saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
