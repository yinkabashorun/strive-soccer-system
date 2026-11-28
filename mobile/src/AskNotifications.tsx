import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setPref } from "@/prefs";
import { turnOnNotifications } from "@/push";
import { Body, Button, Head } from "@/ui";
import { color } from "@/theme";

// Asked once, after the first post that went up: whether to say when a
// friend posts, with the reason. Nothing else is asked or offered here.
// Shown after the training card when a post opens one (app/card.tsx), and
// on the post screen itself when it does not (app/post.tsx).
export function AskNotifications({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [turningOn, setTurningOn] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: color.black, paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <Head size={34}>Know the moment your friends post?</Head>
      <Body dim style={{ marginTop: 12 }}>
        We tell you when a friend posts or gives you props. Never more than that, and never late at night.
      </Body>
      <Body dim size={13} style={{ marginTop: 10 }}>
        You can change this any time in Settings.
      </Body>
      <View style={{ flex: 1 }} />
      <Button
        label="Turn on notifications"
        busy={turningOn}
        onPress={() => {
          setTurningOn(true);
          void turnOnNotifications()
            .catch(() => false)
            .then(onDone);
        }}
      />
      <Button
        quiet
        style={{ marginTop: 10 }}
        label="Not now"
        onPress={() => {
          void setPref("pushAsked", true).then(onDone);
        }}
      />
    </View>
  );
}
