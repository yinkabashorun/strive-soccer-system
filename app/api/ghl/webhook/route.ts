import { NextResponse } from "next/server";
import { ghlContactToLead, type GHLContactPayload } from "@/lib/ghl";

// POST /api/ghl/webhook
//
// Wire this URL into your GoHighLevel webhook step:
//   https://<your-strive-os>/api/ghl/webhook
//
// Supported events (sent by GHL automations):
//   - contact.created       → upserts a Lead
//   - contact.updated       → updates Lead
//   - opportunity.stage_changed → updates Lead.status
//   - payment.received      → flips Player.paymentStatus to "Paid"
//   - appointment.booked    → adds Player to Session.enrolled

type GHLPayload = {
  event: string;
  data: GHLContactPayload & {
    stage?: string;
    amount?: number;
    appointmentId?: string;
    sessionId?: string;
  };
};

export async function POST(req: Request) {
  // Verify the GHL signature here when wiring to production:
  // const sig = req.headers.get("x-ghl-signature");
  // if (!verifySignature(sig, body, process.env.GHL_WEBHOOK_SECRET)) {
  //   return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  // }

  const body = (await req.json().catch(() => null)) as GHLPayload | null;
  if (!body?.event) {
    return NextResponse.json({ error: "missing event" }, { status: 400 });
  }

  switch (body.event) {
    case "contact.created":
    case "contact.updated": {
      const lead = ghlContactToLead(body.data);
      // await supabase().from("leads").upsert(lead);
      return NextResponse.json({ ok: true, lead });
    }
    case "opportunity.stage_changed": {
      // await supabase()
      //   .from("leads")
      //   .update({ status: mapStageToStatus(body.data.stage) })
      //   .eq("id", body.data.id);
      return NextResponse.json({ ok: true });
    }
    case "payment.received": {
      // await supabase()
      //   .from("players")
      //   .update({ payment_status: "Paid" })
      //   .eq("ghl_contact_id", body.data.id);
      return NextResponse.json({ ok: true });
    }
    case "appointment.booked": {
      // await supabase().from("session_attendance").insert({
      //   session_id: body.data.sessionId,
      //   player_ghl_id: body.data.id,
      // });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json(
        { ok: false, ignored: body.event },
        { status: 200 }
      );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "Strive OS · GHL webhook",
    accepts: [
      "contact.created",
      "contact.updated",
      "opportunity.stage_changed",
      "payment.received",
      "appointment.booked",
    ],
  });
}
