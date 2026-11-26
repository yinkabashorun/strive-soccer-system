import { useEffect, useRef } from "react";
import { AppState, View } from "react-native";
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
import { areaFor, areaHome, inArea, localRoute, pushRoute, tappedNotice, type Area, type TappedNotice, hasTrain } from "@/navigation";
import { clearBadge, keepTokenFresh } from "@/push";
import { loadOutbox } from "@/outbox";
import { loadClock } from "@/clock";
import { loadPrefs } from "@/prefs";
import { UpdateGate } from "@/UpdateGate";
import { BrokenScreen } from "@/BrokenScreen";
import { noteScreen, reportUncaught } from "@/report-error";
import { color } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// A screen that cannot be drawn shows the app's own screen and tells the
// coaches (src/BrokenScreen.tsx); an error nothing caught is told too.
export const ErrorBoundary = BrokenScreen;
reportUncaught();

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
  const area = ready ? areaFor(signedIn, me.data?.state, me.data?.profileSetup, me.data?.emailConfirm) : null;
  // Strive Pro is on for someone who lives in the free tabs (one-app.ts)
  const train = hasTrain(me.data?.state);

  useEffect(() => {
    if (!area) return;
    if (!inArea(area, segments, train)) router.replace(areaHome(area, train) as Href);
  }, [area, segments, router, train]);

  // where the app is, for an error report (src/report-error.ts)
  useEffect(() => {
    noteScreen(segments);
  }, [segments]);

  // A phone that already said yes stays on file, for a member and for a
  // free account alike (the server keeps each under its own kind).
  useEffect(() => {
    if (area === "app" || area === "free") void keepTokenFresh();
  }, [area]);

  // Drills ticked with no signal the last time the app was open are read
  // back from the phone and sent (src/outbox.ts).
  useEffect(() => {
    if (area === "app" || (area === "free" && train)) void loadOutbox();
    // a training clock kept on this phone, and a post still waiting to be
    // sent: read back, and the post tried, the moment the free app opens
    if (area === "free") void loadClock();
  }, [area, train]);

  // The launch screen stays up until the first screen is the right one:
  // the person is where they belong, or it is known that this cannot be
  // read (the holding screen says so). A few seconds at most, whatever
  // happens: the launch screen must never be where the app gets stuck.
  const unreadable = ready && signedIn && !me.data && (me.isError || me.isPaused);
  const settled = unreadable || (area !== null && inArea(area, segments, train));
  useEffect(() => {
    if (settled) return void SplashScreen.hideAsync().catch(() => undefined);
    const id = setTimeout(() => void SplashScreen.hideAsync().catch(() => undefined), LAUNCH_SCREEN_MAX_MS);
    return () => clearTimeout(id);
  }, [settled]);

  // The example-data build only (review screenshots on GitHub's Mac): open
  // the screen the run asked for, once, after the gate above has settled.
  const fixtureOpened = useRef(false);
  useEffect(() => {
    if (!FIXTURES || fixtureOpened.current || !area || !inArea(area, segments, train)) return;
    fixtureOpened.current = true;
    const route = fixtureRoute();
    if (route) router.push(route as Href);
  }, [area, segments, router, train]);

  // A tapped notification opens the screen it is about (ONE map from the
  // address the notice carries to a screen here: src/navigation.ts
  // pushRoute, lib/elite/notice-routes.ts). A new week opens Home, a medal
  // opens You, the coach opens the Inbox, a friend's post opens Friends, a
  // club's session or game opens that club.
  //
  // A tap that arrives before the app knows who this is waits: the
  // notification that STARTED the app (read once, below), or one tapped
  // while the agreement or a gate is up. It is opened the moment the person
  // is in the app or the free app, and never before: a notice does not
  // jump a gate.
  const where = useRef<Area | null>(null);
  where.current = area;
  const waiting = useRef<TappedNotice | null>(null);
  const lastTap = useRef<string | null>(null);
  const inside = (area === "app" || area === "free") && inArea(area, segments, train);
  const withTrain = useRef(false);
  withTrain.current = train;
  const settledIn = useRef(false);
  settledIn.current = inside;

  // a notice the phone gave itself (the clock left running) opens its own
  // screen; everything else opens what the site's notice names
  const routeOf = (notice: TappedNotice) =>
    localRoute(where.current, notice) ?? pushRoute(where.current, notice.url, notice.topic, withTrain.current);

  useEffect(() => {
    const take = (res: Notifications.NotificationResponse | null) => {
      if (!res || res.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      // the same tap can be handed over twice (as the one that started the
      // app, and again to the listener): it is opened once
      const id = `${res.notification.request.identifier}:${res.notification.date}`;
      if (lastTap.current === id) return;
      lastTap.current = id;
      const notice = tappedNotice(res);
      if (settledIn.current) router.navigate(routeOf(notice) as Href);
      else waiting.current = notice;
    };
    try {
      take(Notifications.getLastNotificationResponse());
      Notifications.clearLastNotificationResponse();
    } catch {
      // no notification started the app
    }
    const sub = Notifications.addNotificationResponseReceivedListener(take);
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (!inside || !waiting.current) return;
    const notice = waiting.current;
    waiting.current = null;
    router.navigate(routeOf(notice) as Href);
  }, [inside, router]);

  // No number sits on the app's icon: whatever is there is cleared each
  // time the app comes to the front (src/push.ts).
  useEffect(() => {
    clearBadge();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") clearBadge();
    });
    return () => sub.remove();
  }, []);

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
            {/* a build too old to work shows one screen and nothing else
                (src/UpdateGate.tsx); every other build goes straight through */}
            <UpdateGate>
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
              <Stack.Screen name="inbox" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="change-password" />
              <Stack.Screen name="delete-account" />
              <Stack.Screen name="profile-setup" options={{ animation: "fade" }} />
              <Stack.Screen name="confirm-email" options={{ animation: "fade", gestureEnabled: false }} />
            </Stack>
            </UpdateGate>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
