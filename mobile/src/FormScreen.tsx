import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { color } from "./theme";

// Every screen with something to type sits in this, so the keyboard behaves
// the same everywhere, the way an iPhone app is expected to:
//   - the page moves up out of the keyboard's way and can be scrolled, so
//     the button under the fields is always reachable
//   - a tap on empty space puts the keyboard away
//   - a tap on a button works on the first tap, with the keyboard still up
//   - dragging the page down drags the keyboard away with it
// `header` stays fixed above the page; `footer` stays fixed below it and
// rides on top of the keyboard.
//
// The first TestFlight build had a sign-in screen with none of this (no way
// to put the keyboard away, the button behind it) and three screens where a
// button needed two taps. tests/logic.test.ts holds every screen with a
// text field to this one component.
export function FormScreen({
  children,
  header,
  footer,
  contentStyle,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.black }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[{ flexGrow: 1 }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}
