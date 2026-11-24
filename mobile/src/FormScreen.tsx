import { createContext, useCallback, useContext, useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "./theme";

// Every screen with something to type sits in this, so the keyboard behaves
// the same everywhere, the way an iPhone app is expected to:
//   - the box being typed in is always in view above the keyboard, and the
//     page can be scrolled, so the button under the fields is reachable
//   - a tap on empty space puts the keyboard away
//   - a tap on a button works on the first tap, with the keyboard still up
//   - dragging the page down drags the keyboard away with it
// `header` stays fixed above the page; `footer` stays fixed below it and
// rides on top of the keyboard. A footer is laid out in the flow, NEVER
// with position absolute: a pinned footer ignores the room made for the
// keyboard and ends up behind it (tests/app-device.test.ts).
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
// `safeTop`: the room for the status bar. It is left on the black frame
// AROUND what scrolls, never inside it, so a page scrolled up is cut off
// under the clock and never runs through it (the same rule as Screen.tsx;
// the simulator showed a club page scrolled into the time, Nov 24 2026). A
// screen with its own fixed `header` leaves that room in the header instead.
//
// THE BOX BEING TYPED IN IS BROUGHT TO THE TOP of a page with a footer. The
// footer rides on the keyboard, so on a page with two boxes the second one
// sat BEHIND the footer's button while the first was being typed in: a tap
// aimed at the phone box on Join free landed on Next (simulator, Nov 24
// 2026). When a box takes the cursor, and again once the keyboard is up,
// the page scrolls that box to just under the top, which leaves the box
// after it in view above the button. A box tells the page it has the
// cursor with useRevealOnFocus (LabeledField does it for every named box).
//
// The first TestFlight build had a sign-in screen with none of this (no way
// to put the keyboard away, the button behind it) and three screens where a
// button needed two taps. tests/app-device.test.ts holds every screen with
// a text field to this one component.
// How far under the top of the page the box being typed in comes to rest.
const REVEAL_TOP = 28;

const RevealContext = createContext<() => void>(() => undefined);

// For a text box inside a FormScreen: pass the result as its onFocus.
export function useRevealOnFocus(): () => void {
  return useContext(RevealContext);
}

export function FormScreen({
  children,
  header,
  footer,
  contentStyle,
  safeTop,
}: {
  children: ReactNode;
  safeTop?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolled = useRef(0);
  const hasFooter = Boolean(footer);

  // Scroll the box that has the cursor to just under the top of the page.
  // Only a page with a footer needs it: without one the scroll view makes
  // room for the keyboard itself.
  const reveal = useCallback(() => {
    if (!hasFooter) return;
    const input = TextInput.State.currentlyFocusedInput();
    const view = scroll.current;
    if (!input || !view) return;
    view.measureInWindow((_vx, viewTop) => {
      input.measureInWindow((_ix, inputTop) => {
        const y = scrolled.current + (inputTop - viewTop) - REVEAL_TOP;
        view.scrollTo({ y: Math.max(0, y), animated: true });
      });
    });
  }, [hasFooter]);
  // a box that takes the cursor: after this frame, when it is the focused one
  const onBoxFocus = useCallback(() => {
    requestAnimationFrame(reveal);
  }, [reveal]);
  // and once the keyboard is up, when the page has its final height
  useEffect(() => {
    if (!hasFooter) return;
    const shown = Keyboard.addListener("keyboardDidShow", reveal);
    return () => shown.remove();
  }, [hasFooter, reveal]);

  const page = (
    <ScrollView
      ref={scroll}
      onScroll={(e) => {
        scrolled.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      style={{ flex: 1, backgroundColor: color.black, marginTop: safeTop && !header ? insets.top : 0 }}
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
    <RevealContext.Provider value={onBoxFocus}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: color.black }}
        behavior={Platform.OS === "ios" && footer ? "padding" : undefined}
      >
        {header}
        {page}
        {footer}
      </KeyboardAvoidingView>
    </RevealContext.Provider>
  );
}
