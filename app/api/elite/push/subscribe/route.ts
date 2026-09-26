import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { createClient, createServiceClient } from "@/lib/elite/supabase/server";

// Stores a player's Web Push subscription (one row per device) so
// lib/elite/push.ts can actually reach them later. Called by
// components/elite/PushOptIn.tsx right after the browser grants
// notification permission and PushManager.subscribe() resolves.
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.playerId || viewer.demo) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  const p256dh = body?.keys?.p256dh as string | undefined;
  const auth = body?.keys?.auth as string | undefined;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "invalid subscription" }, { status: 400 });
  }

  // RLS-scoped client if available; the service client is only a fallback
  // for pre-auth-wiring dev environments, same pattern as the rest of the
  // player-facing routes in this app.
  const supabase = createClient() ?? createServiceClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });

  const { error } = await supabase.from("elite_push_subscriptions").upsert(
    { player_id: viewer.playerId, endpoint, p256dh, auth },
    { onConflict: "player_id,endpoint" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.playerId || viewer.demo) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createClient() ?? createServiceClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });

  await supabase
    .from("elite_push_subscriptions")
    .delete()
    .eq("player_id", viewer.playerId)
    .eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
