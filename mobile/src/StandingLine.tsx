import { useEffect, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { passedFriend, standingLine, standingSaid, type StandRow } from "./social-view";
import { Body, Eyebrow, Label, Press } from "./ui";

// Where you stand this week, in one line (src/social-view.ts standingLine):
// "You're 1 session away from beating Nico." At the top of Friends, where
// a tap opens the training clock (the line says a session wins it, so the
// tap starts one), and over the board on Week.
//
// `perDay`: the length of one of the player's own training days, which is
// what "a session" means in the line.
//
// The payoff: when the board comes back with a friend passed since this
// screen last read it, a gold "You passed Nico" sits over the line until
// the screen is left. Gold, because it was earned.
//
// Nothing is drawn with no friends on the board yet.
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
  const [passed, setPassed] = useState<string | null>(null);
  useEffect(() => {
    const who = passedFriend(last.current, board);
    if (who) setPassed(who);
    last.current = board;
  }, [board]);

  const s = standingLine(board, perDay);
  if (!s) return null;
  const said = `${passed ? `You passed ${passed}. ` : ""}${standingSaid(s)}`;
  const words = (
    <>
      {passed ? <Eyebrow style={{ marginBottom: 4 }}>{`You passed ${passed}`}</Eyebrow> : null}
      <Body dim size={14} numberOfLines={2}>
        <Label size={14}>{`${s.strong}.`}</Label>
        {s.rest ? ` ${s.rest}` : ""}
      </Body>
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
