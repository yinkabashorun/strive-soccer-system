import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  UPDATE_BODY,
  UPDATE_BUTTON,
  UPDATE_NO_LINK,
  UPDATE_TITLE,
  cleanAppLink,
  cleanAppVersion,
  mustUpdate,
  type AppVersion,
} from "@shared/app-version";
import { api } from "@/api/client";
import { Body, Button, Head } from "@/ui";
import { color } from "@/theme";

// THE OLDEST BUILD THAT STILL WORKS (lib/elite/app-version.ts).
//
// Each time the app opens it asks the server one small question, signed in
// or not: which build is the oldest that still works, and where is the
// app. A build under that number shows this one screen and nothing else:
// what happened, and one button to the new version. Everything a player
// has is on the server, so nothing is lost by updating, and it says so.
//
// It fails OPEN, always: no connection, an answer that cannot be read, a
// build number this phone cannot read about itself: the app opens as it
// always did. The answer lives in memory only and is asked again each time
// the app starts, and when it comes back to the front after ten minutes,
// so a number raised by mistake and put back lets everyone straight in.
const ASK_AGAIN_MS = 10 * 60_000;

// This build's own number, as the TestFlight workflow wrote it into the
// app's config.
function ownBuild(): string | null {
  return Constants.expoConfig?.ios?.buildNumber ?? null;
}

export function UpdateGate({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState<AppVersion | null>(null);
  const asked = useRef(0);

  useEffect(() => {
    let gone = false;
    const ask = () => {
      if (Date.now() - asked.current < ASK_AGAIN_MS) return;
      asked.current = Date.now();
      api<AppVersion>("/api/app/version", { open: true, timeoutMs: 8000 })
        .then((v) => {
          if (!gone) setVersion(cleanAppVersion(v));
        })
        .catch(() => {
          // no answer: the app opens as it always did, and asks again later
          asked.current = 0;
        });
    };
    ask();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") ask();
    });
    return () => {
      gone = true;
      sub.remove();
    };
  }, []);

  if (!mustUpdate(ownBuild(), version)) return <>{children}</>;
  return <UpdateScreen link={version?.link ?? null} />;
}

function UpdateScreen({ link }: { link: string | null }) {
  const insets = useSafeAreaInsets();
  // Apple's own two hosts only (checked again here): TestFlight or the
  // App Store opens, which is the one time the app sends a player out.
  const safe = cleanAppLink(link);
  // the launch screen is taken down by the app's first screen, which is
  // not drawn while this one is up: it comes down here
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24 }]}>
      <Image source={require("../assets/splash.png")} style={styles.mark} contentFit="contain" />
      <Head size={30} style={{ marginTop: 28, textAlign: "center" }}>{UPDATE_TITLE}</Head>
      <Body style={{ marginTop: 12, textAlign: "center" }}>{UPDATE_BODY}</Body>
      {safe ? (
        <View style={{ marginTop: 28, alignSelf: "stretch" }}>
          <Button label={UPDATE_BUTTON} onPress={() => void Linking.openURL(safe).catch(() => undefined)} />
        </View>
      ) : (
        <Body style={{ marginTop: 20, textAlign: "center" }}>{UPDATE_NO_LINK}</Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.black, alignItems: "center", paddingHorizontal: 24 },
  mark: { width: 64, height: 64 },
});
