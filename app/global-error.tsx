"use client";

import { useReportError } from "@/lib/elite/report-error";

// Only reached when the ROOT layout itself fails, so this page has to
// bring its own <html> and <body> and cannot rely on globals.css loading.
// Same report, same calm copy as app/error.tsx; inline styles only.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);
  const reference = error?.digest ?? null;

  return (
    <html lang="en" style={{ background: "#000" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#f4efe6",
          fontFamily: "Barlow, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: 28,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#D4AF37",
            }}
          >
            Something went wrong
          </div>
          <h1
            style={{
              margin: "10px 0 0",
              fontSize: 28,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
            }}
          >
            This page hit an error
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.6)" }}>
            It has been logged and Coach Yinka will see it. Tap try again. If
            you were in the middle of saving something, check it once you are
            back in.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#D4AF37",
                color: "#000",
                border: 0,
                borderRadius: 14,
                padding: "12px 20px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#f4efe6",
                borderRadius: 14,
                padding: "12px 20px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to the app
            </a>
          </div>
          {reference && (
            <p style={{ margin: "20px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              Reference {reference}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
