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
import { areaFor, areaHome, inArea, pushRoute, type Area } from "@/navigation";
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
    if (!inArea(area, segments)) router.replace(areaHome(area) as Href);
  }, [area, segments, router]);

  // A phone that already said yes stays on file, for a member and for a
  // free account alike (the server keeps each under its own kind).
  useEffect(() => {
    if (area === "app" || area === "free") void keepTokenFresh();
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

  // A tapped notification opens the app where this person lives: Home for
  // a member (the week, the coach), Friends for a free account (a friend
  // posted, props), and the club itself for a club's session or game
  // (src/navigation.ts pushRoute; the address rides on the notification as
  // Apple delivers it, under trigger.payload).
  const where = useRef<Area | null>(null);
  where.current = area;
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const trigger = res.notification.request.trigger as { payload?: Record<string, unknown> } | null;
      router.navigate(pushRoute(where.current, trigger?.payload?.url) as Href);
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
        {/* buster: raised when what is kept on the phone changes shape (2: a
            free account's stage, and what a member still owes of the quiz),
            so a screen saved by the version before is read fresh once. */}
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: "2" }}>
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
              <Stack.Screen name="(free)" options={{ animation: "fade" }} />
              <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
              <Stack.Screen name="join/[step]" />
              <Stack.Screen name="offer" options={{ animation: "fade" }} />
              <Stack.Screen name="week-plan" />
              <Stack.Screen name="post" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="club/[id]/index" />
              <Stack.Screen name="club/[id]/manage" />
              <Stack.Screen name="club/[id]/plan" />
              <Stack.Screen name="club/[id]/near" />
              <Stack.Screen name="club/start" />
              <Stack.Screen name="club/join" />
              <Stack.Screen name="club/how" options={{ presentation: "modal" }} />
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
