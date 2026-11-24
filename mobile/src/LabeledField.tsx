import { useRef, type ComponentRef, type RefObject } from "react";
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { useRevealOnFocus } from "@/FormScreen";
import { Label } from "@/ui";
import { color } from "@/theme";

// A text box with its name written above it.
//
// Three things a name above a box has to get right on a phone, all held by
// tests/app-device.test.ts:
//   1. A tap on the name puts the cursor in the box. A player aims at the
//      words as often as at the box under them, and a tap that does nothing
//      reads as a broken form.
//   2. The name and the box are ONE thing to a screen reader (and to the
//      simulator's tapping pass): the box carries the name, and the words
//      above it are not announced a second time.
//   3. A box that takes the cursor is scrolled into reach (FormScreen), and
//      the keyboard's own Next key moves to the box after it (`inputRef`
//      and `onSubmitEditing`, set by the screen).
// Every screen that writes a name above a box uses this, never its own copy.
export function LabeledField({
  label,
  labelSize = 13,
  gap = 8,
  style,
  inputStyle,
  inputRef,
  onFocus,
  ...input
}: Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  // the screen's own handle on the box, to move the cursor to it
  inputRef?: RefObject<ComponentRef<typeof TextInput> | null>;
  labelSize?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  inputStyle: StyleProp<TextStyle>;
}) {
  const own = useRef<ComponentRef<typeof TextInput>>(null);
  const box = inputRef ?? own;
  const reveal = useRevealOnFocus();
  return (
    <View style={style}>
      <Pressable
        onPress={() => box.current?.focus()}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        hitSlop={{ top: 6, bottom: gap }}
        style={{ marginBottom: gap, alignSelf: "flex-start" }}
      >
        <Label dim size={labelSize}>
          {label}
        </Label>
      </Pressable>
      <TextInput
        ref={box}
        style={inputStyle}
        placeholderTextColor={color.faint}
        accessibilityLabel={label}
        onFocus={(e) => {
          reveal();
          onFocus?.(e);
        }}
        {...input}
      />
    </View>
  );
}
