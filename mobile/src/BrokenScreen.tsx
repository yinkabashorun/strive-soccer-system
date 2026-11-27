import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import type { ErrorBoundaryProps } from "expo-router";
import { reportAppError } from "@/report-error";
import { Body, Button, Head } from "@/ui";
import { color } from "@/theme";

// When a screen cannot be drawn: the app's own calm screen, in the app's
// own look, with one way on. (Before this it was the framework's stock
// error page.) What broke is sent to the coaches' App errors card, once
// (src/report-error.ts).
//
// It stands outside everything the app wraps its screens in, so it uses
// nothing that needs them: fixed spacing, no safe-area reading, no data.
export const BROKEN_TITLE = "That screen didn't load";
export const BROKEN_BODY = "Nothing of yours is lost. Try it again.";
export const BROKEN_RETRY = "Try again";

export function BrokenScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportAppError(error, "screen");
    // if this is the first thing drawn, the launch screen comes down here
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [error]);
  return (
    <View style={styles.fill}>
      <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" />
      <Head size={30} style={{ marginTop: 28, textAlign: "center" }}>{BROKEN_TITLE}</Head>
      <Body style={{ marginTop: 12, textAlign: "center" }}>{BROKEN_BODY}</Body>
      <View style={{ marginTop: 28, alignSelf: "stretch" }}>
        <Button label={BROKEN_RETRY} onPress={() => void retry()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, alignItems: "center", paddingHorizontal: 24, paddingTop: 150 },
  mark: { width: 64, height: 64 },
});
