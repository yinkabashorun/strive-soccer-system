import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { CLOCK_WORDS, clockFace, clockLength } from "@shared/training-clock";
import { useClockView } from "./clock";
import { clockButton, shotUri, type ClockView } from "./clock-core";
import { Body, Eyebrow, Head, Icon, Press } from "./ui";
import { color } from "./theme";

// A clock that is running (or ready to post) is never out of sight: this
// row sits at the top of Friends and Week for as long as there is one, and
// one tap opens it. A player who started the clock, trained, and opened
// the app an hour later lands straight on their finish photo.
//
// Nothing is shown when there is no clock.

// What the button that opens the clock says right now ("Start training",
// "Finish my training", "Post my training").
export function useClockButton(): string {
  return clockButton(useClockView().view);
}

function lines(view: ClockView): { eyebrow: string; big: string; small: string } | null {
  if (view.at === "running") return { eyebrow: CLOCK_WORDS.running, big: clockFace(view.seconds), small: CLOCK_WORDS.finish };
  if (view.at === "capped") return { eyebrow: CLOCK_WORDS.running, big: clockFace(view.seconds), small: CLOCK_WORDS.finish };
  if (view.at === "ready") return { eyebrow: CLOCK_WORDS.ready, big: clockLength(view.minutes), small: CLOCK_WORDS.postShort };
  if (view.at === "expired") return { eyebrow: CLOCK_WORDS.running, big: CLOCK_WORDS.expiredHead, small: CLOCK_WORDS.typedButton };
  return null;
}

export function ClockRow() {
  const router = useRouter();
  const { clock, view } = useClockView();
  const said = lines(view);
  if (!clock || !said) return null;
  const uri = shotUri(clock.finish ?? clock.start);
  return (
    <Press onPress={() => router.push("/post")} style={styles.row} accessibilityRole="button" accessibilityLabel={`${said.eyebrow}. ${said.big}. ${said.small}`}>
      {uri ? (
        <View style={styles.thumb}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Eyebrow>{said.eyebrow}</Eyebrow>
        <Head size={view.at === "expired" ? 22 : 30} style={styles.big} numberOfLines={1}>
          {said.big}
        </Head>
        <Body dim size={13}>
          {said.small}
        </Body>
      </View>
      <Icon name="chevron" size={18} stroke={color.faint} />
    </Press>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 14,
    marginTop: 16,
    padding: 12,
    minHeight: 84,
    borderRadius: 22,
    backgroundColor: color.fill2,
    borderWidth: 1,
    // bone, not gold: gold is for what was earned
    borderColor: "rgba(242,239,232,0.45)",
  },
  thumb: { width: 52, height: 64, borderRadius: 12, overflow: "hidden", backgroundColor: color.black },
  // every digit the same width, so the row does not shake as it counts
  big: { fontVariant: ["tabular-nums"], textTransform: "none", marginTop: 2 },
});
