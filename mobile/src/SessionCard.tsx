import type { ComponentRef, RefObject } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { CARD_POINT, CARD_POINTS, cardSaid, cardShade, quoteSize, type CardFace } from "@shared/session-card";
import { Shade } from "@/Shade";
import { color, font } from "@/theme";

// THE TRAINING CARD, drawn with views over the player's own photo: the
// layout of the mock Coach Yinka saw (Nov 28 2026), in the app's own type
// (Oswald for the big type, Inter for the labels; gold only on ELITE, the
// eyebrows and who said the quote). What goes on it is decided in
// lib/elite/session-card.ts cardFace; this only draws it.
//
// It is laid out at CARD_POINTS (360 x 640), every size written as the
// picture's own pixels divided by CARD_POINT, so the card the screen shows
// scaled down and the 1080 x 1920 picture it captures are the same card.
// Text never follows the phone's text size here: the picture is the same
// picture on every phone.
const px = (n: number) => n / CARD_POINT;

// The view the picture is captured from (src/card-native.ts makeCardFile).
export type CardView = ComponentRef<typeof View>;

// onReady: the photo is drawn (true) or could not be loaded (false); a card
// is never captured before its photo is on it.
type Props = { face: CardFace; photo: string; onReady?: (drawn: boolean) => void; cardRef?: RefObject<CardView | null> };

export function SessionCard({ face, photo, onReady, cardRef }: Props) {
  const q = face.quote;
  return (
    <View ref={cardRef} collapsable={false} style={styles.card} accessible accessibilityRole="image" accessibilityLabel={cardSaid(face)}>
      <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" onLoad={() => onReady?.(true)} onError={() => onReady?.(false)} />
      <Shade id={q ? "card-shade-quote" : "card-shade"} stops={cardShade(Boolean(q))} />

      <View style={styles.top}>
        <Text allowFontScaling={false} style={styles.brand}>
          STRIVE <Text style={{ color: color.gold }}>ELITE</Text>
        </Text>
        <Text allowFontScaling={false} style={styles.date}>
          {face.dateLine}
        </Text>
      </View>

      {q ? (
        <View style={styles.quote}>
          <Text allowFontScaling={false} style={[styles.quoteText, { fontSize: px(quoteSize(q.text)), lineHeight: px(quoteSize(q.text) * 1.12) }]}>
            {q.text}
          </Text>
          <Text allowFontScaling={false} style={styles.by}>
            {q.by}
          </Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        <Text allowFontScaling={false} style={styles.eyebrow}>
          {face.eyebrow}
        </Text>
        <Text allowFontScaling={false} style={styles.time}>
          {face.time}
        </Text>
        {face.note ? (
          <Text allowFontScaling={false} numberOfLines={2} style={styles.note}>
            {face.note}
          </Text>
        ) : null}
        {face.stats ? (
          <View style={styles.stats}>
            {face.stats.map((s) => (
              <View key={s.label}>
                <Text allowFontScaling={false} style={styles.statValue}>
                  {s.value}
                </Text>
                <Text allowFontScaling={false} style={styles.statLabel}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.foot}>
        <Text allowFontScaling={false} style={styles.link}>
          {face.link}
        </Text>
        {/* Apple's own badge artwork goes here once APP_STORE_BADGE_LIVE
            is on (lib/elite/session-card.ts); until then nothing is drawn. */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_POINTS.width, height: CARD_POINTS.height, backgroundColor: color.black, overflow: "hidden" },
  top: { position: "absolute", top: px(150), left: px(72), right: px(72) },
  brand: { fontFamily: font.head, fontSize: px(54), lineHeight: px(64), letterSpacing: px(4), color: color.bone },
  date: { fontFamily: font.label, fontSize: px(30), marginTop: px(10), letterSpacing: px(1), color: "rgba(242,239,232,0.82)" },
  quote: { position: "absolute", top: px(330), left: px(72), right: px(72) },
  quoteText: {
    fontFamily: font.head,
    textTransform: "uppercase",
    letterSpacing: px(1),
    color: color.bone,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: px(2) },
    textShadowRadius: px(18),
  },
  by: { fontFamily: font.label, fontSize: px(28), letterSpacing: px(3), textTransform: "uppercase", color: color.gold, marginTop: px(18) },
  bottom: { position: "absolute", left: px(72), right: px(72), bottom: px(230) },
  eyebrow: { fontFamily: font.label, fontSize: px(28), letterSpacing: px(8), textTransform: "uppercase", color: color.gold },
  time: { fontFamily: font.head, fontSize: px(230), lineHeight: px(240), marginTop: px(6), color: color.bone },
  note: { fontFamily: font.label, fontSize: px(40), lineHeight: px(52), marginTop: px(10), color: color.bone },
  stats: { flexDirection: "row", gap: px(56), marginTop: px(40), paddingTop: px(30), borderTopWidth: px(2), borderTopColor: "rgba(242,239,232,0.25)" },
  statValue: { fontFamily: font.head, fontSize: px(64), lineHeight: px(74), letterSpacing: px(1), color: color.bone },
  statLabel: { fontFamily: font.label, fontSize: px(26), letterSpacing: px(4), textTransform: "uppercase", color: "rgba(242,239,232,0.62)", marginTop: px(4) },
  foot: { position: "absolute", left: px(72), right: px(72), bottom: px(110), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { fontFamily: font.label, fontSize: px(30), color: "rgba(242,239,232,0.85)" },
});
