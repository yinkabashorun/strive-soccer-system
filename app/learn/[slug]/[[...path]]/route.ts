import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { getPlayer } from "@/lib/elite/data";
import { resolveSiteRequest } from "@/lib/elite/private-sites";

// Private course sites (Nov 5 2026): static pages served behind the login.
// Coaches and admins can read them (to check the course); a player needs an
// active or trialing membership, the same rule as the player shell; a
// prospect in the demo tour and a signed-out visitor are sent to sign in.
// Nothing here is cached or indexed.
export const dynamic = "force-dynamic";

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(req: NextRequest, { params }: { params: { slug: string; path?: string[] } }) {
  const target = resolveSiteRequest(params.slug, params.path);
  if (target.kind === "none") return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const signIn = () => {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", "/courses");
    return NextResponse.redirect(url);
  };

  const viewer = await getViewer();
  if (!viewer || viewer.demo) return signIn();

  if (viewer.role === "player") {
    if (!viewer.playerId) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    const player = await getPlayer(viewer.playerId);
    const status = player?.subscription_status ?? "none";
    if (status !== "active" && status !== "trialing") {
      return new NextResponse("Your Strive Elite membership isn't active right now. Reach out to your coach to reactivate.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  if (target.kind === "redirect-entry") return NextResponse.redirect(new URL(target.to, req.url));

  try {
    const html = await fs.readFile(path.join(process.cwd(), target.dir, target.file), "utf8");
    return new NextResponse(html, { status: 200, headers: HEADERS });
  } catch {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
