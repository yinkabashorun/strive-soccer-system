import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "./theme";

// A tab's page: black, under the status bar, with pull to refresh. The page
// is drawn from the cache at once; pulling (or coming back to the app)
// fetches behind it.
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
    <ScrollView
      style={{ flex: 1, backgroundColor: color.black }}
      contentContainerStyle={[{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + bottom }, style]}
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
  );
}
