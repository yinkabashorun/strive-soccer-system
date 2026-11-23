import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { color, font, metal } from "./theme";
import { Head } from "./ui";

// The member card (the door and the top of You): the Strive Elite wordmark,
// their name, member since and the tier. Earned by joining, nothing to pass,
// no member number (experience.md). "Elite" and the tier are in the metal:
// membership is the one thing every member has earned. The photo and the
// @username sit on it once the profile step (migration 081) is live.
export function MemberCard({
  name,
  since,
  tier,
  photoUrl,
  username,
  rise = false,
}: {
  name: string;
  since: string | null;
  tier: string;
  photoUrl?: string | null;
  username?: string | null;
  rise?: boolean;
}) {
  const reduce = useReducedMotion();
  const up = useSharedValue(rise ? 0 : 1);
  const sheen = useSharedValue(rise ? -1 : 2);
  useEffect(() => {
    if (!rise) return;
    if (reduce) {
      up.value = withTiming(1, { duration: 300 });
      return;
    }
    up.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    sheen.value = withDelay(1400, withTiming(2, { duration: 1100, easing: Easing.inOut(Easing.quad) }));
  }, [rise, reduce, up, sheen]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: up.value,
    transform: reduce ? [] : [{ translateY: (1 - up.value) * 60 }, { perspective: 900 }, { rotateX: `${(1 - up.value) * 14}deg` }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sheen.value * 320 }, { rotate: "18deg" }] }));

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Strive Elite member card. ${name}. ${since ?? ""}. ${tier}.`}
    >
      <View style={styles.top}>
        <Svg width={190} height={30}>
          <Defs>
            <LinearGradient id="cardMetal" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={metal.from} />
              <Stop offset="0.5" stopColor={metal.mid} />
              <Stop offset="1" stopColor={metal.to} />
            </LinearGradient>
          </Defs>
          <SvgText x={0} y={24} fontFamily={font.head} fontSize={22} letterSpacing={1.3} fill={color.bone}>
            STRIVE
          </SvgText>
          <SvgText x={86} y={24} fontFamily={font.head} fontSize={22} letterSpacing={1.3} fill="url(#cardMetal)">
            ELITE
          </SvgText>
        </Svg>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" transition={200} />
        ) : (
          <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" />
        )}
      </View>
      <View style={styles.bottom}>
        <View style={{ flex: 1 }}>
          <Head size={19} style={{ letterSpacing: 1.3 }}>
            {name}
          </Head>
          {username ? <Head size={13} style={{ color: color.dim, marginTop: 2, textTransform: "none" }}>@{username}</Head> : null}
          {since ? <Head size={11} style={{ color: color.dim, letterSpacing: 2, marginTop: 6, fontFamily: font.label }}>{since}</Head> : null}
        </View>
        <Svg width={90} height={20}>
          <Defs>
            <LinearGradient id="tierMetal" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={metal.from} />
              <Stop offset="0.5" stopColor={metal.mid} />
              <Stop offset="1" stopColor={metal.to} />
            </LinearGradient>
          </Defs>
          <SvgText x={90} y={16} textAnchor="end" fontFamily={font.head} fontSize={14} letterSpacing={2.8} fill="url(#tierMetal)">
            {tier.toUpperCase()}
          </SvgText>
        </Svg>
      </View>
      {rise && !reduce ? <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 204,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "rgba(200,168,88,0.32)",
    padding: 22,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  mark: { width: 38, height: 38, opacity: 0.9 },
  photo: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: "rgba(200,168,88,0.5)" },
  bottom: { flexDirection: "row", alignItems: "flex-end" },
  sheen: { position: "absolute", top: -80, bottom: -80, left: -120, width: 90, backgroundColor: "rgba(255,255,255,0.08)" },
});
