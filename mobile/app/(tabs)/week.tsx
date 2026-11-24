import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { AppSession } from "@shared/app-contract";
import { keys, useWeek } from "@/api/queries";
import { useRefused, useTicks } from "@/outbox";
import { REFUSED_LINE, UNSENT_LINE } from "@/outbox-core";
import { queryClient } from "@/api/queryClient";
import { PAGE_TOP, Screen } from "@/Screen";
import { HERO_SHADE, Shade } from "@/Shade";
import { Body, Disc, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color, radius } from "@/theme";
import { nextCard, nextStills, rowLine, weekRows, weekSummary, type WeekRow } from "@/week-view";

// Week: the week as a path, top to bottom (src/week-view.ts has the rules).
// A finished session is a short row with a gold tick. The session the week
// is waiting on is the one big card: its photo, the drills inside it and
// Start. What is still ahead is quieter. The line down the left turns gold
// as far as the player has got.
export default function Week() {
  const router = useRouter();
  const { data: w } = useWeek();
  const rows = w ? weekRows(w) : [];
  const summary = w ? weekSummary(w) : "";
  // the truth about saving, said once, here
  const unsent = useTicks().length > 0;
  const refused = useRefused();
  const notSaved = Boolean(w?.sessions.some((s) => s.drills.some((d) => refused.includes(d.id))));

  return (
    <Screen onRefresh={() => queryClient.invalidateQueries({ queryKey: keys.week })}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>{w && w.week > 0 ? `Week ${w.week}` : "Your week"}</Head>
        {w?.range ? (
          <Body dim size={13.5} style={{ marginTop: 6 }}>
            {w.range}
          </Body>
        ) : null}
      </View>

      {!w ? (
        <View style={{ padding: 14, gap: 10 }}>
          <Skeleton height={62} r={18} />
          <Skeleton height={236} r={radius.tile} />
          <Skeleton height={92} r={radius.tile} />
        </View>
      ) : w.week === 0 ? (
        <Body dim style={{ marginHorizontal: 20, marginTop: 16 }}>
          {w.nextWeekLine}
        </Body>
      ) : (
        <>
          {w.focus ? <Body style={{ marginHorizontal: 20, marginTop: 16, fontSize: 16, lineHeight: 22 }}>{w.focus}</Body> : null}
          {summary ? (
            <Label size={13} style={{ marginHorizontal: 20, marginTop: 10, color: color.dim }}>
              {summary}
            </Label>
          ) : null}
          {w.oneMore ? (
            <Label size={14} style={{ marginHorizontal: 20, marginTop: 8 }}>
              {w.oneMore}
            </Label>
          ) : null}

          {notSaved || unsent ? (
            <Body dim={!notSaved} size={13} style={{ marginHorizontal: 20, marginTop: 8 }}>
              {notSaved ? REFUSED_LINE : UNSENT_LINE}
            </Body>
          ) : null}

          {w.weekDone ? (
            <View style={styles.complete} accessible accessibilityLabel={`Week ${w.week} complete. ${w.nextWeekLine}`}>
              <Disc size={44} earned>
                <Icon name="check" size={20} stroke="#1a1408" />
              </Disc>
              <View style={{ flex: 1 }}>
                <Head size={22}>{`Week ${w.week} complete`}</Head>
                <Body dim size={13} style={{ marginTop: 3 }}>
                  {w.nextWeekLine}
                </Body>
              </View>
            </View>
          ) : null}

          <View style={styles.path}>
            {rows.map((r, i) => (
              <Animated.View key={r.s.n} entering={FadeInDown.delay(i * 60).duration(320)} style={styles.row}>
                <Rail r={r} />
                <View style={styles.cell}>
                  <SessionRow r={r} onPress={() => router.push(`/session/${r.s.n}`)} />
                </View>
              </Animated.View>
            ))}
          </View>

          {w.weekDone ? null : (
            <Body dim size={13} style={{ marginHorizontal: 20, marginTop: 18 }}>
              {w.nextWeekLine}
            </Body>
          )}
        </>
      )}
    </Screen>
  );
}

// The line down the left and this session's mark on it.
function Rail({ r }: { r: WeekRow }) {
  const tone = (t: "gold" | "grey") => (t === "gold" ? color.gold : color.fill2);
  return (
    <View style={styles.rail}>
      {r.lineAbove ? <View style={[styles.line, { top: 0, height: "50%", backgroundColor: tone(r.lineAbove) }]} /> : null}
      {r.lineBelow ? <View style={[styles.line, { bottom: 0, height: "50%", backgroundColor: tone(r.lineBelow) }]} /> : null}
      {r.state === "done" ? (
        <Disc size={26} earned>
          <Icon name="check" size={13} stroke="#1a1408" />
        </Disc>
      ) : r.state === "next" ? (
        <View style={styles.nodeNext}>
          <View style={styles.nodeNextDot} />
        </View>
      ) : (
        <View style={styles.nodeOpen} />
      )}
    </View>
  );
}

function SessionRow({ r, onPress }: { r: WeekRow; onPress: () => void }) {
  const { s, state } = r;
  if (state === "next") return <NextCard s={s} onPress={onPress} />;
  const line = rowLine(s, state);

  if (state === "done") {
    return (
      <Press onPress={onPress} accessibilityLabel={`${s.name}, done. ${line}`} style={styles.done}>
        <View style={{ flex: 1 }}>
          <Label size={15}>{s.name}</Label>
          <Body dim size={12.5} numberOfLines={1} style={{ marginTop: 2 }}>
            {line}
          </Body>
        </View>
        <Label size={12} style={{ color: color.gold }}>
          Done
        </Label>
      </Press>
    );
  }

  return (
    <Press onPress={onPress} accessibilityLabel={`${s.name}. ${line}`} style={styles.open}>
      {s.image ? <Image source={{ uri: s.image }} style={[StyleSheet.absoluteFill, { opacity: 0.34 }]} contentFit="cover" transition={200} /> : null}
      <View style={{ flex: 1 }}>
        <Head size={22}>{s.name}</Head>
        <Body size={13} numberOfLines={1} style={{ marginTop: 4, color: "rgba(244,241,234,0.78)" }}>
          {line}
        </Body>
      </View>
      <Icon name="chevron" size={20} stroke={color.dim} />
    </Press>
  );
}

// The session the week is waiting on.
function NextCard({ s, onPress }: { s: AppSession; onPress: () => void }) {
  const words = nextCard(s);
  const { stills, more } = nextStills(s);
  return (
    <Press onPress={onPress} accessibilityLabel={`${words.eyebrow}: ${s.name}. ${words.line}. ${words.button}.`} style={styles.next}>
      {s.image ? <Image source={{ uri: s.image }} style={[StyleSheet.absoluteFill, { opacity: 0.9 }]} contentFit="cover" transition={200} /> : null}
      <Shade id="weekNext" stops={HERO_SHADE} />
      <View style={styles.nextText}>
        <Eyebrow gold={false} style={{ color: color.bone }}>
          {words.eyebrow}
        </Eyebrow>
        <Head size={34} style={{ marginTop: 6 }}>
          {s.name}
        </Head>
        {s.headline ? (
          <Body size={15} style={{ marginTop: 4 }}>
            {s.headline}
          </Body>
        ) : null}
        <View style={styles.stills}>
          {stills.map((d) => (
            <View key={d.id} style={styles.still}>
              {d.poster ? <Image source={{ uri: d.poster }} style={[StyleSheet.absoluteFill, { opacity: d.done ? 0.4 : 1 }]} contentFit="cover" /> : null}
              {d.done ? <Icon name="check" size={16} stroke={color.gold} /> : null}
            </View>
          ))}
          {more > 0 ? (
            <View style={styles.still}>
              <Label size={13} dim>{`+${more}`}</Label>
            </View>
          ) : null}
        </View>
        <View style={styles.nextFoot}>
          <Body size={13} style={{ flex: 1, color: "rgba(244,241,234,0.82)" }}>
            {words.line}
          </Body>
          <View style={styles.start}>
            <Icon name="play" size={14} fill={color.black} />
            <Label size={15} style={{ color: color.black }}>
              {words.button}
            </Label>
          </View>
        </View>
      </View>
    </Press>
  );
}

const RAIL = 34;

const styles = StyleSheet.create({
  complete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 14,
    marginTop: 16,
    padding: 16,
    borderRadius: radius.tile,
    backgroundColor: color.fill,
    borderWidth: 1,
    borderColor: "rgba(200,168,88,0.4)",
  },
  path: { marginTop: 12, paddingLeft: 8, paddingRight: 14 },
  row: { flexDirection: "row", alignItems: "stretch" },
  cell: { flex: 1, paddingVertical: 5 },
  rail: { width: RAIL, alignItems: "center", justifyContent: "center" },
  line: { position: "absolute", left: RAIL / 2 - 1, width: 2 },
  nodeNext: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: color.bone,
    backgroundColor: color.black,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeNextDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.bone },
  nodeOpen: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "rgba(242,239,232,0.3)", backgroundColor: color.black },
  done: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: color.fill,
    borderWidth: 1,
    borderColor: color.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  open: {
    minHeight: 88,
    borderRadius: radius.tile,
    overflow: "hidden",
    backgroundColor: "#060606",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 14,
  },
  next: { minHeight: 268, borderRadius: radius.tile, overflow: "hidden", backgroundColor: "#060606", justifyContent: "flex-end" },
  nextText: { padding: 18 },
  stills: { flexDirection: "row", gap: 8, marginTop: 14 },
  still: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: color.fill2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  nextFoot: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  start: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: color.bone,
  },
});
