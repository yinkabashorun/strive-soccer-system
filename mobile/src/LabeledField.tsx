import { useRef, type ComponentRef } from "react";
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { Label } from "@/ui";
import { color } from "@/theme";

// A text box with its name written above it.
//
// Two things a name above a box has to get right on a phone, both held by
// tests/app-device.test.ts:
//   1. A tap on the name puts the cursor in the box. A player aims at the
//      words as often as at the box under them, and a tap that does nothing
//      reads as a broken form.
//   2. The name and the box are ONE thing to a screen reader (and to the
//      simulator's tapping pass): the box carries the name, and the words
//      above it are not announced a second time.
// Every screen that writes a name above a box uses this, never its own copy.
export function LabeledField({
  label,
  labelSize = 13,
  gap = 8,
  style,
  inputStyle,
  ...input
}: Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  labelSize?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  inputStyle: StyleProp<TextStyle>;
}) {
  const box = useRef<ComponentRef<typeof TextInput>>(null);
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
      <TextInput ref={box} style={inputStyle} placeholderTextColor={color.faint} accessibilityLabel={label} {...input} />
    </View>
  );
}
