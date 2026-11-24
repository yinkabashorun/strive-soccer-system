import { useEffect, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { color, font, metal, MIN_TAP, motion, radius } from "./theme";

// The handful of pieces every screen is built from, in the approved look.

type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; selectable?: boolean };

// Oswald Bold, upper case: headlines and the big numbers.
export function Head({ children, size = 34, style, numberOfLines }: TProps & { size?: number }) {
  return (
    <Text
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.3}
      style={[{ fontFamily: font.head, fontSize: size, lineHeight: Math.round(size * 1.06), color: color.bone, textTransform: "uppercase", letterSpacing: 0.4 }, style]}
    >
      {children}
    </Text>
  );
}

// Inter SemiBold, tracked: the small gold or dim labels above things.
export function Eyebrow({ children, style, gold = true }: TProps & { gold?: boolean }) {
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      style={[{ fontFamily: font.label, fontSize: 11, letterSpacing: 2.6, textTransform: "uppercase", color: gold ? color.gold : color.dim }, style]}
    >
      {children}
    </Text>
  );
}

// selectable: words a player is meant to copy out (a lesson's templates).
export function Body({ children, style, dim, size = 15, numberOfLines, selectable }: TProps & { dim?: boolean; size?: number }) {
  return (
    <Text numberOfLines={numberOfLines} selectable={selectable} style={[{ fontFamily: font.body, fontSize: size, lineHeight: Math.round(size * 1.4), color: dim ? color.dim : color.bone }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children, style, dim, size = 15, numberOfLines }: TProps & { dim?: boolean; size?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: font.label, fontSize: size, color: dim ? color.dim : color.bone }, style]}>
      {children}
    </Text>
  );
}

// A control that answers the moment it is touched: it sinks a little and
// comes back (motion.tap), or just dims when the phone asks for less motion.
export function Press({ children, style, disabled, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: reduce ? (s.value < 1 ? 0.7 : 1) : 1 }));
  // The style sits on the pressable itself, so a control laid out with
  // flex (a segment, a rating box) takes its place in the row.
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      onPressIn={(e) => {
        s.value = withTiming(0.97, { duration: motion.tap, easing: Easing.out(Easing.quad) });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: motion.tap * 1.5, easing: Easing.out(Easing.quad) });
        rest.onPressOut?.(e);
      }}
      style={[style, a, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The one main button: bone with black text, never gold.
export function Button({
  label,
  onPress,
  disabled,
  busy,
  icon,
  style,
  quiet,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  quiet?: boolean;
}) {
  return (
    <Press
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      style={[quiet ? styles.quiet : styles.button, style]}
    >
      {busy ? (
        <ActivityIndicator color={quiet ? color.bone : color.black} />
      ) : (
        <View style={styles.buttonRow}>
          {icon}
          <Text style={[styles.buttonText, quiet ? { color: color.bone } : null]}>{label}</Text>
        </View>
      )}
    </Press>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Grey shapes of what is coming, never a spinner (experience.md).
export function Skeleton({ height, width = "100%", style, r = 18 }: { height: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle>; r?: number }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1);
  }, [o, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: r, backgroundColor: color.fill2 }, a, style]} />;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// The gold ring: what was done of what was planned. It closes over the
// reward time when it first shows (or at once, with less motion).
export function Ring({
  size,
  stroke,
  value,
  track = color.fill2,
  animate = true,
  duration = motion.reward,
  children,
}: {
  size: number;
  stroke: number;
  value: number;
  track?: string;
  animate?: boolean;
  duration?: number;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const p = useSharedValue(animate && !reduce ? 0 : v);
  useEffect(() => {
    p.value = animate && !reduce ? withTiming(v, { duration, easing: Easing.out(Easing.cubic) }) : v;
  }, [v, animate, reduce, duration, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={metal.from} />
            <Stop offset="0.45" stopColor={metal.mid} />
            <Stop offset="1" stopColor={metal.to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {v > 0 && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#metal)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            animatedProps={props}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

// A disc in the metal gradient (a medal, a done tick), or dim when not
// earned yet.
export function Disc({ size, earned, children }: { size: number; earned: boolean; children?: ReactNode }) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="disc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={metal.from} />
            <Stop offset="0.45" stopColor={metal.mid} />
            <Stop offset="1" stopColor={metal.to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={earned ? "url(#disc)" : color.fill2} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>{children}</View>
    </View>
  );
}

export function Icon({ name, size = 22, stroke = color.bone, fill }: { name: IconName; size?: number; stroke?: string; fill?: string }) {
  const d = ICONS[name];
  const solid = name === "play";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={d}
        stroke={solid ? "none" : stroke}
        fill={solid ? fill ?? stroke : "none"}
        strokeWidth={name === "check" ? 3 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export type IconName = "play" | "check" | "close" | "timer" | "chevron" | "back" | "plus" | "lock" | "download";
const ICONS: Record<IconName, string> = {
  play: "M7 4.5v15l13-7.5z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6 6 18",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9 2h6",
  chevron: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  lock: "M7.5 11V8a4.5 4.5 0 0 1 9 0v3M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11z",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14",
};

export function SettingRow({
  label,
  detail,
  onPress,
  danger,
  value,
  onValue,
}: {
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  value?: boolean;
  onValue?: (v: boolean) => void;
}) {
  const body = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Label style={danger ? { color: color.danger } : null}>{label}</Label>
        {detail ? (
          <Body dim size={13} style={{ marginTop: 2 }} numberOfLines={2}>
            {detail}
          </Body>
        ) : null}
      </View>
      {onValue ? (
        <Switch value={Boolean(value)} onValueChange={onValue} trackColor={{ true: color.bone, false: color.fill2 }} thumbColor={color.black} accessibilityLabel={label} />
      ) : onPress ? (
        <Icon name="chevron" size={18} stroke={color.faint} />
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Press onPress={onPress} accessibilityLabel={label}>
      {body}
    </Press>
  );
}

export function Hairline() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)", marginLeft: 16 }} />;
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 60,
    borderRadius: radius.button,
    backgroundColor: color.bone,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  quiet: {
    minHeight: 56,
    borderRadius: radius.button,
    backgroundColor: color.fill,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttonText: { fontFamily: font.head, fontSize: 19, letterSpacing: 1.6, textTransform: "uppercase", color: color.black },
  card: { backgroundColor: color.fill, borderRadius: radius.tile, borderWidth: 1, borderColor: color.line, padding: 16 },
  row: { minHeight: MIN_TAP + 16, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
