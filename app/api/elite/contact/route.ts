import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Contact form sink. Logs the enquiry (visible in Vercel logs) and, if a
// GHL webhook is configured, forwards it into the CRM. Kept intentionally
// simple — no PII stored server-side beyond the log line.
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  console.log("[strive-elite] contact enquiry", {
    name: body.name,
    email: body.email,
    player_age: body.player_age,
  });

  const hook = process.env.GHL_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "strive-elite-contact", ...body }),
      });
    } catch {
      /* non-blocking */
    }
  }

  return NextResponse.json({ ok: true });
}
