import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getViewer } from "@/lib/elite/session";
import { nyToday } from "@/lib/elite/time";
import { trackerFor, weekLogsFor } from "@/lib/elite/tracker-server";
import { CARD_HANDLE, cardFacts, tracksGym } from "@/lib/elite/tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The weekly card: a story-size picture (1080 x 1920) of the signed-in
// player's own week. On it: the time trained this week, the dates, the
// first name, STRIVE ELITE and the handle, and one small gym line when
// gym work was logged this week. Nothing else. Only the player can ask
// for their card; it is never stored or cached.

const FONT_DIR = join(process.cwd(), "lib", "elite", "fonts");
let fonts: Promise<{ black: Buffer; semi: Buffer }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "BarlowCondensed-900.ttf")),
    readFile(join(FONT_DIR, "Barlow-600.ttf")),
  ]).then(([black, semi]) => ({ black, semi }));
  return fonts;
}

const GOLD = "#c8a858";
const BONE = "#F5F4EF";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in first.", { status: 401 });
  const tracker = await trackerFor(viewer);
  if (!tracker) return new Response("Not found.", { status: 404 });

  const today = nyToday();
  // Gym shows only for a player who tracks it (in high school or older).
  const week = await weekLogsFor(viewer, tracker, today);
  const facts = cardFacts({
    fullName: viewer.profile.full_name,
    logs: tracksGym(tracker.grade) ? week : week.filter((l) => l.kind !== "gym"),
    today,
  });
  const { black, semi } = await loadFonts();

  const picture = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#000000",
          color: BONE,
          padding: "250px 80px 230px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Barlow Condensed",
            fontWeight: 900,
            fontSize: 76,
            letterSpacing: 6,
          }}
        >
          <span>STRIVE</span>
          <span style={{ color: GOLD, marginLeft: 22 }}>ELITE</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Barlow",
              fontWeight: 600,
              fontSize: 40,
              letterSpacing: 10,
              color: GOLD,
            }}
          >
            {facts.name.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Barlow Condensed",
              fontWeight: 900,
              fontSize: 330,
              lineHeight: 1,
              marginTop: 36,
            }}
          >
            {facts.time}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Barlow",
              fontWeight: 600,
              fontSize: 44,
              letterSpacing: 10,
              marginTop: 34,
            }}
          >
            TRAINED THIS WEEK
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Barlow",
              fontWeight: 600,
              fontSize: 40,
              marginTop: 18,
              color: "rgba(245,244,239,0.65)",
            }}
          >
            {facts.week}
          </div>
          {facts.gym && (
            <div
              style={{
                display: "flex",
                fontFamily: "Barlow",
                fontWeight: 600,
                fontSize: 40,
                marginTop: 44,
                color: GOLD,
              }}
            >
              {facts.gym}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Barlow",
            fontWeight: 600,
            fontSize: 40,
            letterSpacing: 4,
            color: "rgba(245,244,239,0.72)",
          }}
        >
          {CARD_HANDLE}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Barlow Condensed", data: black, weight: 900, style: "normal" },
        { name: "Barlow", data: semi, weight: 600, style: "normal" },
      ],
    }
  );
  // ImageResponse marks what it draws as public and cacheable for a year.
  // This is one player's own week, so the picture goes out under headers
  // of our own instead: private, never stored.
  return new Response(picture.body, {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
