import { View, type StyleProp, type ViewStyle } from "react-native";
import { standingLine, standingSaid, type StandRow } from "./social-view";
import { Body, Label, Press } from "./ui";

// Where you stand this week, in one line (src/social-view.ts standingLine):
// at the top of Friends, where a tap opens the board, and over the board
// on Week. Nothing is drawn with no friends on the board yet.
export function StandingLine({ board, onPress, style }: { board: readonly StandRow[]; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const s = standingLine(board);
  if (!s) return null;
  const words = (
    <Body dim size={14} numberOfLines={2}>
      <Label size={14}>{`${s.strong}.`}</Label>
      {s.rest ? ` ${s.rest}` : ""}
    </Body>
  );
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={standingSaid(s)}>
        {words}
      </View>
    );
  }
  return (
    <Press onPress={onPress} style={[{ minHeight: 44, justifyContent: "center" }, style]} accessibilityLabel={`${standingSaid(s)} Open your week`}>
      {words}
    </Press>
  );
}
