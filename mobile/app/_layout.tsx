import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
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
import { fixtureRoute } from "@/api/fixtures";
import { FIXTURES } from "@/config";
import { areaFor, AREA_ROOT, inArea } from "@/navigation";
import { keepTokenFresh } from "@/push";
import { loadPrefs } from "@/prefs";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// A member gate that moved under a request (the agreement came due, the
// membership was switched off): read who this is again and follow it.
setGateListener(() => queryClient.invalidateQueries({ queryKey: keys.me }));

// The longest the launch screen may stay up waiting for the first screen.
const LAUNCH_SCREEN_MAX_MS = 4000;

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

  // The launch screen stays up until the first screen is the right one:
  // the person is where they belong, or it is known that this cannot be
  // read (the holding screen says so). A few seconds at most, whatever
  // happens: the launch screen must never be where the app gets stuck.
  const unreadable = ready && signedIn && !me.data && (me.isError || me.isPaused);
  const settled = unreadable || (area !== null && inArea(area, segments));
  useEffect(() => {
    if (settled) return void SplashScreen.hideAsync().catch(() => undefined);
    const id = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), LAUNCH_SCREEN_MAX_MS);
    return () => clearTimeout(id);
  }, [settled]);

  // The example-data build only (review screenshots on GitHub's Mac): open
  // the screen the run asked for, once, after the gate above has settled.
  const fixtureOpened = useRef(false);
  useEffect(() => {
    if (!FIXTURES || fixtureOpened.current || !area || !inArea(area, segments)) return;
    fixtureOpened.current = true;
    const route = fixtureRoute();
    if (route) router.push(route as Href);
  }, [area, segments, router]);

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
  const [fontsLoaded, fontsFailed] = useFonts({
    "Oswald-Bold": require("../assets/fonts/Oswald-Bold.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
  });

  useEffect(() => {
    void loadPrefs();
  }, []);
  // A font that will not load must not hold the app on its launch screen:
  // the app opens in the phone's own type instead.
  if (!fontsLoaded && !fontsFailed) return <View style={{ flex: 1, backgroundColor: color.black }} />;

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
                statusBarStyle: "light",
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
              <Stack.Screen name="course/[slug]" />
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
