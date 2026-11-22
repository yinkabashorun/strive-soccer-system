import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { cleanDeviceToken } from "@/lib/elite/apns";
import { trackerFor } from "@/lib/elite/tracker-server";

// Stores the device token the App Store app hands the site once a member
// allows notifications (migration 067), so lib/elite/push.ts can reach the
// phone through Apple's push service. A token names a phone, so the save is
// an upsert on the token itself: the phone follows whoever is signed in on
// it. The service client is used after the viewer check for that reason
// (moving a row between players is not something a player's own RLS allows).
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return NextResponse.json({ ok: false }, { status: 401 });
  // A free account (078) is on file by profile; a member by player.
  const free = !viewer.playerId && (await trackerFor(viewer)) !== null;
  if (!viewer.playerId && !free) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const token = cleanDeviceToken(body?.token);
  if (!token) return NextResponse.json({ ok: false, error: "invalid token" }, { status: 400 });

  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  const { error } = await admin.from("elite_native_push_tokens").upsert(
    {
      player_id: free ? null : viewer.playerId,
      profile_id: free ? viewer.profile.id : null,
      token,
      platform: "ios",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Notifications turned off from the Account page: the phone comes off file.
export async function DELETE(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return NextResponse.json({ ok: false }, { status: 401 });
  const free = !viewer.playerId && (await trackerFor(viewer)) !== null;
  if (!viewer.playerId && !free) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const token = cleanDeviceToken(body?.token);
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  await admin
    .from("elite_native_push_tokens")
    .delete()
    .eq(free ? "profile_id" : "player_id", free ? viewer.profile.id : viewer.playerId!)
    .eq("token", token);
  return NextResponse.json({ ok: true });
}
