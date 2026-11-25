// Draws the week card (lib/elite/week-card.ts) as a story-size PNG, 1080 x
// 1920, on the server. Oswald Bold for the headline type and Inter SemiBold
// for the labels (the app's own type, OFL, the licences sit beside the
// files in lib/elite/fonts). Gold is only on what was earned: the part of
// the ring that is filled and the days with training. Nothing here is
// stored or cached; the caller sends the picture to the one player it
// belongs to.
//
// Written with createElement, not JSX, so the same file runs under Next
// and under the tests without a JSX setting of its own.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement as h, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { SHARE_LINE } from "./share-link";
import { CARD_HANDLE } from "./tracker";
import { WEEK_CARD_BRAND, WEEK_CARD_HEIGHT, WEEK_CARD_TITLE, WEEK_CARD_WIDTH, type WeekCard } from "./week-card";

const FONT_DIR = join(process.cwd(), "lib", "elite", "fonts");
let fonts: Promise<{ head: Buffer; label: Buffer }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([readFile(join(FONT_DIR, "Oswald-Bold.ttf")), readFile(join(FONT_DIR, "Inter-SemiBold.ttf"))]).then(
    ([head, label]) => ({ head, label })
  );
  // a failed read is tried again on the next card, never remembered
  fonts.catch(() => {
    fonts = null;
  });
  return fonts;
}

const BONE = "#F2EFE8";
const DIM = "rgba(242,239,232,0.62)";
const QUIET = "rgba(242,239,232,0.13)";
// the earned gold, as a metal: light at the top, deep at the bottom
const GOLD = "#c8a858";
const GOLD_LIGHT = "#f0dca0";
const GOLD_DEEP = "#8c6d2c";

const HEAD = "Oswald";
const LABEL = "Inter";

const RING = 620;
const STROKE = 36;

function box(style: CSSProperties, ...children: ReactNode[]): ReactElement {
  return h("div", { style: { display: "flex", ...style } }, ...children);
}

function label(text: string, size: number, style: CSSProperties = {}): ReactElement {
  return box({ fontFamily: LABEL, fontWeight: 600, fontSize: size, color: DIM, ...style }, text);
}

// The big time shrinks for a long one ("12h 30m") so it always sits inside
// the ring with room on both sides.
export function timeSize(time: string): number {
  if (time.length <= 3) return 220;
  if (time.length <= 6) return 156;
  return 132;
}

function ring(card: WeekCard): ReactElement {
  const r = (RING - STROKE) / 2;
  const around = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, card.share)) * around;
  const circle = { cx: RING / 2, cy: RING / 2, r, fill: "none", strokeWidth: STROKE };
  return box(
    { position: "relative", width: RING, height: RING, alignItems: "center", justifyContent: "center" },
    h(
      "svg",
      { width: RING, height: RING, viewBox: `0 0 ${RING} ${RING}`, style: { position: "absolute", top: 0, left: 0 } },
      h(
        "defs",
        null,
        h(
          "linearGradient",
          { id: "earned", x1: "0", y1: "0", x2: "1", y2: "1" },
          h("stop", { offset: "0", stopColor: GOLD_LIGHT }),
          h("stop", { offset: "0.5", stopColor: GOLD }),
          h("stop", { offset: "1", stopColor: GOLD_DEEP })
        )
      ),
      h("circle", { ...circle, stroke: QUIET }),
      filled > 0
        ? h("circle", {
            ...circle,
            stroke: "url(#earned)",
            strokeLinecap: "round",
            // a circle is drawn from three o'clock; a quarter turn of
            // offset starts the gold at the top, and leaves the metal's
            // light at the top left where the days' marks have theirs
            strokeDasharray: `${filled} ${around - filled}`,
            strokeDashoffset: around / 4,
          })
        : null
    ),
    box(
      { flexDirection: "column", alignItems: "center" },
      box({ fontFamily: HEAD, fontWeight: 700, fontSize: timeSize(card.time), lineHeight: 1.05, color: BONE }, card.time),
      card.of ? label(card.of, 46, { marginTop: 6 }) : null
    )
  );
}

function days(card: WeekCard): ReactElement {
  return box(
    { gap: 30 },
    ...card.days.map((d) =>
      box(
        { flexDirection: "column", alignItems: "center", gap: 18 },
        label(d.letter, 30, { color: d.trained ? BONE : DIM }),
        box({
          width: 76,
          height: 76,
          borderRadius: 38,
          background: d.trained ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD} 50%, ${GOLD_DEEP})` : QUIET,
        })
      )
    )
  );
}

export function weekCardElement(card: WeekCard): ReactElement {
  return box(
    {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#000000",
      color: BONE,
      // a story's own chrome sits over the top and the bottom of the picture
      padding: "250px 80px 236px",
    },
    box(
      { flexDirection: "column", alignItems: "center" },
      box({ fontFamily: HEAD, fontWeight: 700, fontSize: 70, letterSpacing: 9, color: BONE }, WEEK_CARD_BRAND),
      label(card.name.toUpperCase(), 36, { letterSpacing: 9, marginTop: 20 })
    ),
    box(
      { flexDirection: "column", alignItems: "center" },
      ring(card),
      label(WEEK_CARD_TITLE, 42, { letterSpacing: 10, color: BONE, marginTop: 56 }),
      label(card.week, 38, { marginTop: 16 }),
      box({ marginTop: 64 }, days(card)),
      card.gym ? label(card.gym, 36, { marginTop: 44 }) : null
    ),
    box(
      { flexDirection: "column", alignItems: "center" },
      // the address only, never the code: the full link rides in the share text
      label(SHARE_LINE, 42, { letterSpacing: 2, color: BONE }),
      label(CARD_HANDLE, 34, { letterSpacing: 2, marginTop: 14 })
    )
  );
}

export async function weekCardPng(card: WeekCard): Promise<Buffer> {
  const { head, label: labelFont } = await loadFonts();
  const picture = new ImageResponse(weekCardElement(card), {
    width: WEEK_CARD_WIDTH,
    height: WEEK_CARD_HEIGHT,
    fonts: [
      { name: HEAD, data: head, weight: 700, style: "normal" },
      { name: LABEL, data: labelFont, weight: 600, style: "normal" },
    ],
  });
  return Buffer.from(await picture.arrayBuffer());
}
