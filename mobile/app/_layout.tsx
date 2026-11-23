import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AuthProvider, useAuth } from "@/auth/session";
import { keys, useMe } from "@/api/queries";
import { PERSIST_MAX_AGE, persister, queryClient } from "@/api/queryClient";
import { setGateListener } from "@/api/client";
import { areaFor, AREA_ROOT, inArea } from "@/navigation";
import { keepTokenFresh } from "@/push";
import { loadPrefs } from "@/prefs";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// A member gate that moved under a request (the agreement came due, the
// membership was switched off): read who this is again and follow it.
setGateListener(() => queryClient.invalidateQueries({ queryKey: keys.me }));

// Sends each person to where they belong (src/navigation.ts) and keeps
// them there: the same order as the website's member shell.
function Gatekeeper() {
  const { ready, signedIn } = useAuth();
  const me = useMe();
  const segments = useSegments();
  const router = useRouter();
  const area = ready ? areaFor(signedIn, me.data?.state, me.data?.profileSetup) : null;

  useEffect(() => {
    if (!area) return;
    if (!inArea(area, segments)) {
      if (area === "app") router.replace("/");
      else if (area === "onboarding") router.replace("/onboarding");
      else router.replace(`/${AREA_ROOT[area]}`);
    }
  }, [area, segments, router]);

  useEffect(() => {
    if (area === "app") void keepTokenFresh();
  }, [area]);

  // A tapped notification opens the app on Home (every notification the
  // site sends is about the week or the coach).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.navigate("/");
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Oswald-Bold": require("../assets/fonts/Oswald-Bold.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
  });

  useEffect(() => {
    void loadPrefs();
  }, []);
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: color.black }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.black }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: "1" }}>
          <AuthProvider>
            <StatusBar style="light" />
            <Gatekeeper />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: color.black },
                animation: "default",
                gestureEnabled: true,
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
              <Stack.Screen name="agreement" options={{ animation: "fade", gestureEnabled: false }} />
              <Stack.Screen name="gate" options={{ animation: "fade", gestureEnabled: false }} />
              <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
              <Stack.Screen name="session/[n]" options={{ presentation: "fullScreenModal", animation: "fade", gestureEnabled: false }} />
              <Stack.Screen name="drop" options={{ presentation: "fullScreenModal", animation: "fade" }} />
              <Stack.Screen name="extra" options={{ presentation: "modal" }} />
              <Stack.Screen name="checkin" options={{ presentation: "modal" }} />
              <Stack.Screen name="settings" />
              <Stack.Screen name="change-password" />
              <Stack.Screen name="delete-account" />
              <Stack.Screen name="profile-setup" options={{ animation: "fade" }} />
            </Stack>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
