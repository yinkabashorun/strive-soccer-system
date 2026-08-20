import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";

export const runtime = "nodejs";

// Coach-only setup helper: relays a realistic sample payload to a GHL
// Inbound Webhook so the workflow builder can capture its mapping
// reference ("Check for new requests"). Locked to GHL hook URLs only.
//
// GET /api/elite/ghl-sample?event=player_signed_up&url=<encoded GHL hook URL>
const ALLOWED_PREFIX = "https://services.leadconnectorhq.com/hooks/";

const SAMPLES: Record<string, { subject: string; body: string }> = {
  player_signed_up: {
    subject: "Welcome to Strive Elite",
    body: "Test Player is officially in the Strive Elite program. Next step: open the app and complete the quick player profile.",
  },
  new_week: {
    subject: "Test — Week 2 is live",
    body: "The new training week just unlocked.\n\nThis week's focus: Scan before you receive.\n\nFour sessions, plyo warm-up first, every time.",
  },
  coach_message: {
    subject: "Your coach sent you a message",
    body: 'Coach: "Great work this week — session 3 was your best yet."',
  },
  checkin_feedback: {
    subject: "Your coach replied to your check-in",
    body: "That scanning progress is exactly what we're after. We'll build on it next week.",
  },
  parent_weekly_report: {
    subject: "Test Player — week 1 report",
    body: "Test Player completed all 4 sessions this week — 210 minutes of focused work and a 6-day streak. His scanning is becoming automatic; next week we take the weak foot head-on. The new training week is live now.",
  },
};

export async function GET(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") ?? "";
  const event = searchParams.get("event") ?? "player_signed_up";
  if (!url.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json(
      { error: "url must be a GHL inbound webhook (services.leadconnectorhq.com/hooks/…)" },
      { status: 400 }
    );
  }
  const sample = SAMPLES[event] ?? SAMPLES.player_signed_up;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        audience: "player",
        subject: sample.subject,
        body: sample.body,
        recipients: [{ name: "Test Parent", email: "test@thestriveapp.com" }],
        player: { name: "Test Player", week: 1 },
        to_name: "Test Parent",
        to_email: "test@thestriveapp.com",
        emails: ["test@thestriveapp.com"],
        app_url: process.env.NEXT_PUBLIC_APP_URL || "https://thestriveapp.com",
        source: "strive-elite",
      }),
    });
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      sent_event: event,
      hint: res.ok
        ? "Sample delivered — go back to GHL and click 'Check for new requests'."
        : "GHL rejected the request — double-check the webhook URL.",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "delivery_failed" }, { status: 502 });
  }
}
