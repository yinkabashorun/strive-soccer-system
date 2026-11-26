import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { qrModules, qrPath } from "@/qr";

// A QR code, drawn here from the text it holds (src/qr.ts).
//
// Dark squares on a WHITE card, with the standard's white margin around
// them: the app is black, and a code drawn light on dark is one some
// cameras will not read. Black and white only: nothing on it is gold, and
// nothing is laid over it.
//
// `said` is what a screen reader says for it (and what the tapped pass
// looks for): the picture is one thing, never read square by square.
export function QrCode({ text, size, said }: { text: string; size: number; said: string }) {
  const { size: grid, d } = useMemo(() => qrPath(qrModules(text)), [text]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={said}
      style={{ width: size, height: size, borderRadius: 24, overflow: "hidden", backgroundColor: "#ffffff" }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${grid} ${grid}`}>
        <Rect x={0} y={0} width={grid} height={grid} fill="#ffffff" />
        <Path d={d} fill="#000000" />
      </Svg>
    </View>
  );
}
