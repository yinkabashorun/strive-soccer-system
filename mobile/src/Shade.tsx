import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

// The dark fall over a photo so the words on it read: transparent at the
// top, black at the bottom, at the stops the approved mock uses.
export function Shade({ stops, id }: { stops: [number, number][]; id: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([at, alpha]) => (
              <Stop key={at} offset={String(at)} stopColor="#000" stopOpacity={alpha} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export const HERO_SHADE: [number, number][] = [
  [0.12, 0],
  [0.46, 0.72],
  [0.64, 0.92],
  [0.96, 1],
];
export const CARD_SHADE: [number, number][] = [
  [0, 0.45],
  [1, 0.65],
];
