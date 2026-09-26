import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { normalizePhone } from "@/lib/elite/sms";
import { sendCoachEmail } from "@/lib/elite/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inbound parent/player SMS replies, relayed here by a GHL workflow
// (trigger: "Customer Replied" -> action: Webhook). GHL owns the sending
// number, so it's the only side that knows a reply arrived - without this,
// every reply just sits unseen in GHL's Conversations inbox instead of
// showing up in the app's existing player chat thread.
//
// Build the GHL workflow's webhook action to send exactly this shape (see
// the setup instructions given alongside this route):
//   { "phone": "{{contact.phone}}", "message": "{{message.body}}" }
export async function POST(req: Request) {
  const secret = process.env.SMS_INBOUND_SECRET;
  if (secret && new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { phone?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const phone = normalizePhone((body.phone ?? "").trim());
  const message = (body.message ?? "").trim();
  if (!phone || !message) {
    return NextResponse.json(
      { error: "phone and message are required" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: true, matched: false });

  // Parent's number is the common case; a player texting from their own
  // phone is the other. Siblings can share one parent_phone, so this
  // threads the reply onto every player it matches rather than guessing.
  const [{ data: byParent }, { data: byPlayer }] = await Promise.all([
    admin
      .from("elite_players")
      .select("id, full_name, parent_name")
      .eq("parent_phone", phone),
    admin.from("elite_players").select("id, full_name").eq("player_phone", phone),
  ]);

  const targets: { playerId: string; fromName: string }[] = [
    ...(byParent ?? []).map((p) => {
      const parentFirst = (p.parent_name || p.full_name || "").trim().split(" ")[0];
      return { playerId: p.id, fromName: parentFirst ? `${parentFirst} (Parent)` : "Parent" };
    }),
    ...(byPlayer ?? []).map((p) => ({ playerId: p.id, fromName: p.full_name })),
  ];

  if (targets.length === 0) {
    // No player on file with this number - nothing to thread it onto.
    return NextResponse.json({ ok: true, matched: false });
  }

  for (const { playerId, fromName } of targets) {
    await admin.from("elite_messages").insert({
      player_id: playerId,
      from_role: "player",
      from_name: fromName,
      body: message,
    });
    await sendCoachEmail(playerId, {
      event: "player_message",
      subject: `New text from ${fromName}`,
      body: `${fromName} texted:\n\n"${message}"`,
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true, matched: true, threads: targets.length });
}
