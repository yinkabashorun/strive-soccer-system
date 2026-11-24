import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { crestIndex, crestOf } from "@shared/tracker";
import { font } from "./theme";

// A club's crest: a shield with two characters in one of six colour pairs,
// worked out from the club's id and name by the website's own rule
// (lib/elite/tracker.ts crestOf), so a club looks the same here, on the
// website and after it is renamed. Never a real club's logo.
export function Crest({ club, size }: { club: { id: string; name: string }; size: number }) {
  const c = crestOf(club);
  // named by its colour pair, so two crests drawn on one screen never take
  // each other's colours
  const fill = `crest-${crestIndex(club.id)}`;
  return (
    <View style={{ width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.from} />
            <Stop offset="1" stopColor={c.to} />
          </LinearGradient>
        </Defs>
        <Circle cx="24" cy="24" r="24" fill={`url(#${fill})`} />
        <Path d="M24 9.5 35.5 13v10.8c0 7.3-5.2 12-11.5 14.7C17.7 35.8 12.5 31.1 12.5 23.8V13z" fill={c.shield} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.letters]}>
        <Text allowFontScaling={false} style={{ fontFamily: font.head, fontSize: Math.max(11, Math.round(size * 0.25)), color: c.ink, letterSpacing: 0.3 }}>
          {c.letters}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  letters: { alignItems: "center", justifyContent: "center", paddingBottom: 1 },
});
