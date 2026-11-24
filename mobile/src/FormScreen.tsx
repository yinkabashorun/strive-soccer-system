import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import { color } from "./theme";

// Every screen with something to type sits in this, so the keyboard behaves
// the same everywhere, the way an iPhone app is expected to:
//   - the box being typed in is always in view above the keyboard, and the
//     page can be scrolled, so the button under the fields is reachable
//   - a tap on empty space puts the keyboard away
//   - a tap on a button works on the first tap, with the keyboard still up
//   - dragging the page down drags the keyboard away with it
// `header` stays fixed above the page; `footer` stays fixed below it and
// rides on top of the keyboard.
//
// How the page makes room is the iPhone's own way: the scroll view takes the
// keyboard as an inset and scrolls the box being typed in into view
// (automaticallyAdjustKeyboardInsets). That is right wherever the page sits,
// including inside a sheet. Lifting the whole page instead
// (KeyboardAvoidingView) measures from the top of the screen, and in a sheet
// it left the weekly check-in's last box under the keyboard: the simulator
// run of Nov 24 2026 showed a player typing into a box they could not see.
// The lift is kept only where a footer has to ride on the keyboard.
//
// The first TestFlight build had a sign-in screen with none of this (no way
// to put the keyboard away, the button behind it) and three screens where a
// button needed two taps. tests/app-device.test.ts holds every screen with
// a text field to this one component.
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
  const page = (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.black }}
      contentContainerStyle={[{ flexGrow: 1 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets={!footer}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
  if (!header && !footer) return page;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.black }}
      behavior={Platform.OS === "ios" && footer ? "padding" : undefined}
    >
      {header}
      {page}
      {footer}
    </KeyboardAvoidingView>
  );
}
