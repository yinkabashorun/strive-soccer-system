import { useEffect, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { seedDay } from "@shared/voice";
import { landedLine, standingLine, standingSaid, type StandRow } from "./social-view";
import { Body, Eyebrow, Label, Press } from "./ui";

// Where you stand this week, in one line (src/social-view.ts standingLine):
// "You're 1 session away from beating Nico." At the top of Friends, where
// a tap opens the training clock (the line says a session wins it, so the
// tap starts one), and over the board on Week.
//
// `perDay`: the length of one of the player's own training days, which is
// what "a session" means in the line.
//
// The payoff (the voice guide, moment 2): when the board comes back with
// the player's own time up since this screen last read it, a gold line sits
// over the standing line until the screen is left: "You just passed Nico."
// when a friend was passed, else one of a few ("45m locked in. Excellent
// work."). Gold, because it was earned.
//
// With no friends on the board yet only the gold line can show.
export function StandingLine({
  board,
  perDay,
  onPress,
  style,
}: {
  board: readonly StandRow[];
  perDay?: number | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const last = useRef<readonly StandRow[] | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  useEffect(() => {
    const line = landedLine(last.current, board, seedDay());
    if (line) setLanded(line);
    last.current = board;
  }, [board]);

  const s = standingLine(board, perDay);
  if (!s && !landed) return null;
  const said = [landed, s ? standingSaid(s) : null].filter(Boolean).join(" ");
  const words = (
    <>
      {landed ? <Eyebrow style={{ marginBottom: s ? 4 : 0 }}>{landed}</Eyebrow> : null}
      {s ? (
        <Body dim size={14} numberOfLines={2}>
          <Label size={14}>{`${s.strong}.`}</Label>
          {s.rest ? ` ${s.rest}` : ""}
        </Body>
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={said}>
        {words}
      </View>
    );
  }
  return (
    <Press onPress={onPress} style={[{ minHeight: 44, justifyContent: "center" }, style]} accessibilityLabel={`${said} Start training`}>
      {words}
    </Press>
  );
}
