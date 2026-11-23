import localFont from "next/font/local";

// The member app's type (approved Nov 20 2026, marketing/app-redesign):
// Oswald Bold for every headline, Inter SemiBold tracked for labels and
// numbers, Inter Medium for body. Open-licence files (OFL, the licences sit
// beside them), subset to Latin and served from our own domain, so no font
// is fetched from anyone else at run time.
//
// The files are declared over a weight range on purpose: Oswald Bold answers
// for 700 to 900 and Inter SemiBold for 600 to 900, so a heavier class never
// makes the browser paint a fake bold.
//
// The variables are set on <html> (app/layout.tsx); a screen switches to
// this type with the member-ui class (app/globals.css), which is how the
// coach side and the public pages keep their Barlow look.
export const oswald = localFont({
  src: [{ path: "./Oswald-Bold.woff2", weight: "700 900", style: "normal" }],
  variable: "--font-oswald",
  display: "swap",
  fallback: ["Barlow Condensed", "ui-sans-serif", "system-ui", "sans-serif"],
});

export const inter = localFont({
  src: [
    { path: "./Inter-Medium.woff2", weight: "400 500", style: "normal" },
    { path: "./Inter-SemiBold.woff2", weight: "600 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
});
