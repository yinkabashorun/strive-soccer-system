"use client";

import Script from "next/script";
import { useEffect } from "react";

// Meta Pixel for the ad landing page only (/demo). Fires PageView on load
// and a Lead event when the embedded GHL survey reports a submission.
// Deliberately NOT on the app itself: members (minors) training in the
// app are not an ad audience, and the privacy policy doesn't cover it.
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function MetaPixel({ id }: { id: string }) {
  useEffect(() => {
    if (!id) return;
    // GHL's embed posts messages from the survey iframe. The exact event
    // names vary by widget version, so match broadly on "submit" coming
    // from a leadconnector origin. Best-effort: a miss just means the
    // Lead fires on the confirmation page instead.
    const onMessage = (e: MessageEvent) => {
      const origin = String(e.origin || "");
      if (!/leadconnectorhq|msgsndr|gohighlevel/i.test(origin)) return;
      let text = "";
      try {
        text = typeof e.data === "string" ? e.data : JSON.stringify(e.data ?? "");
      } catch {
        text = "";
      }
      if (/submit/i.test(text) && window.fbq) {
        window.fbq("track", "Lead");
        window.removeEventListener("message", onMessage);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  if (!id) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
