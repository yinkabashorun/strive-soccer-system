import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "./theme";

// A tab's page: black, under the status bar, with pull to refresh. The page
// is drawn from the cache at once; pulling (or coming back to the app)
// fetches behind it.
//
// This is the ONE place a tab's page leaves room for the status bar at the
// top and the floating tab bar at the bottom (the tab bar's own automatic
// room is switched off in app/(tabs)/_layout.tsx). A page inside it adds
// PAGE_TOP above its headline and nothing more.
//
// The scroll view itself starts BELOW the status bar: the room for the
// clock is on the black frame around it, not inside what scrolls. So a page
// scrolled up is cut off under the clock and never runs through it (build
// 7 on his phone, Nov 24 2026: "WEEK 10" scrolled into the time).
export const PAGE_TOP = 6;

// The same rule for a page that is pushed on top of the tabs and scrolls on
// its own (a club, settings, the offer): this goes on the scroll view's own
// `style`, never in its content. The frame behind every screen is black
// (app/_layout.tsx), so the room above the scroll view is the black the
// clock sits on. tests/app-device.test.ts refuses the status bar's room
// inside anything that scrolls.
export function useBelowClock(): ViewStyle {
  const insets = useSafeAreaInsets();
  return { marginTop: insets.top };
}

export function Screen({
  children,
  onRefresh,
  style,
  bottom = 120,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<unknown>;
  style?: StyleProp<ViewStyle>;
  bottom?: number;
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: color.black, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: color.black }}
        contentContainerStyle={[{ paddingTop: 14, paddingBottom: insets.bottom + bottom }, style]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              tintColor={color.bone}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await onRefresh().catch(() => undefined);
                setRefreshing(false);
              }}
            />
          ) : undefined
        }
      >
        <View>{children}</View>
      </ScrollView>
    </View>
  );
}
