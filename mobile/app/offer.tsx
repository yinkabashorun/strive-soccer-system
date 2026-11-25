import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppBootstrap } from "@shared/app-contract";
import { keys, useMe } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { confirmUpgrade, rereadMe, startUpgrade, useOffer } from "@/api/free";
import { openHome } from "@/go-home";
import { MemberCard } from "@/MemberCard";
import { hasTrain } from "@/navigation";
import { openLink, openSite } from "@/links";
import { Shade } from "@/Shade";
import { useMyPhoto } from "@/usePhoto";
import { Body, Button, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { useBelowClock } from "@/Screen";
import { color } from "@/theme";

// The offer. A free account sees it once, right after the quiz and its
// photo, and can open it again from the one card on Week or from a locked
// course. Every word and the price come from the server
// (lib/elite/offer.ts): what is named is the player's own weakest areas,
// and the drills are filmed ones from the bank that train them.
//
// The card at the top is THEIR card, with their photo and @username, the
// same component the door and You use. One button starts the membership;
// the quiet one under it goes on to the free app. Nothing counts down,
// nothing is promised.
//
// Start: the server makes this account's member row (once) and answers
// with the card checkout's address, which opens in a sheet over the app.
// When the sheet closes the server is asked whether it was paid and this
// account is read again; a paid one is carried on by the gatekeeper, an
// unpaid one stays right here on the free side.
export default function Offer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const me = useMe();
  const photo = useMyPhoto();
  const offer = useOffer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const o = offer.data;
  // After the quiz there is nowhere to go back to: the quiet button goes on
  // to the week's set-up. Opened later from the free app, it closes.
  const first = me.data?.state.kind === "free" && me.data.state.stage === "offer";

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await startUpgrade();
      if (!res.ok) return setError(res.error);
      await openLink(res.url);
      await confirmUpgrade().catch(() => null);
      await rereadMe();
      // Paid, and Strive Pro is on at once: the offer is done, open Train
      // (src/go-home.ts). An account that still owes a step is outside this
      // area and the gatekeeper carries it there; an unpaid one stays here.
      if (hasTrain(queryClient.getQueryData<AppBootstrap>(keys.me)?.state)) openHome(router);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  function later() {
    if (first) router.push("/week-plan");
    else router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView
        style={[{ flex: 1 }, belowClock]}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {first ? (
          <View style={{ height: 8 }} />
        ) : (
          <Press onPress={() => router.back()} style={styles.close} accessibilityLabel="Close">
            <Icon name="close" />
          </Press>
        )}

        <View style={{ marginHorizontal: 20 }}>
          {o ? (
            <MemberCard name={o.card.name} since={null} tier={o.card.tier} photo={photo} username={me.data?.profileSetup?.username} rise={first} />
          ) : (
            <Skeleton height={204} r={22} />
          )}
        </View>

        {o ? (
          <Animated.View entering={FadeInDown.delay(first ? 500 : 0).duration(400)}>
            <Head size={30} style={{ marginHorizontal: 20, marginTop: 18 }}>
              {o.headline}
            </Head>

            {o.drills.length ? (
              <>
                <Eyebrow style={{ marginHorizontal: 20, marginTop: 18 }}>{o.drillsLabel}</Eyebrow>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.drills}>
                  {o.drills.map((d) => (
                    <View key={d.poster} style={styles.drill} accessible accessibilityRole="image" accessibilityLabel={o.drillLocked}>
                      <Image source={{ uri: d.poster }} style={styles.still} contentFit="cover" transition={200} cachePolicy="disk" />
                      <View style={styles.lock}>
                        <Icon name="lock" size={15} stroke={color.bone} />
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <View style={{ marginHorizontal: 20, marginTop: 22, gap: 10 }}>
              {o.gets.map((g) => (
                <View key={g} style={styles.get}>
                  <Icon name="check" size={16} stroke={color.dim} />
                  <Body style={{ flex: 1 }}>{g}</Body>
                </View>
              ))}
            </View>

            {/* the two documents the line under the button names, one tap each */}
            <View style={styles.links}>
              <Press onPress={() => void openSite("/terms")} style={styles.link} accessibilityRole="link">
                <Label dim size={12}>Terms of Service</Label>
              </Press>
              <Press onPress={() => void openSite("/privacy")} style={styles.link} accessibilityRole="link">
                <Label dim size={12}>Privacy Policy</Label>
              </Press>
            </View>
          </Animated.View>
        ) : offer.isError ? (
          <View style={{ margin: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={offer.isFetching} onPress={() => void offer.refetch()} />
          </View>
        ) : (
          <View style={{ margin: 20, gap: 12 }}>
            <Skeleton height={70} />
            <Skeleton height={170} />
          </View>
        )}
      </ScrollView>

      {o ? (
        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          {/* the page runs on under the buttons: a soft fall, not a hard cut */}
          <View style={styles.fall} pointerEvents="none">
            <Shade id="offer-fall" stops={FALL} />
          </View>
          <Label size={16} style={{ textAlign: "center" }}>
            {o.price}
          </Label>
          {error ? (
            <Body size={13.5} style={{ color: color.danger, textAlign: "center", marginTop: 8 }}>
              {error}
            </Body>
          ) : null}
          <Button style={{ marginTop: 12 }} label={o.start} busy={busy} onPress={() => void start()} />
          {o.parent ? (
            <Button
              quiet
              style={{ marginTop: 10 }}
              label={o.parent.label}
              onPress={() => void Share.share({ message: o.parent!.text }).catch(() => undefined)}
            />
          ) : null}
          <Press onPress={later} disabled={busy} style={styles.later} accessibilityLabel={o.later}>
            <Label dim size={15}>
              {o.later}
            </Label>
          </Press>
          <Body dim size={11.5} style={{ textAlign: "center" }}>
            {o.terms}
          </Body>
        </View>
      ) : null}
    </View>
  );
}

// clear at the top of the strip, black where it meets the buttons
const FALL: [number, number][] = [
  [0, 0],
  [1, 1],
];

const styles = StyleSheet.create({
  close: { width: 44, height: 44, justifyContent: "center", marginLeft: 16, marginBottom: 4 },
  drills: { paddingHorizontal: 20, gap: 10, marginTop: 12 },
  drill: { width: 108 },
  still: { width: 108, height: 128, borderRadius: 16, backgroundColor: color.fill2 },
  lock: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  get: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  foot: { paddingHorizontal: 20, paddingTop: 8, backgroundColor: color.black },
  fall: { position: "absolute", left: 0, right: 0, top: -28, height: 28 },
  later: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 2 },
  links: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 14 },
  link: { minHeight: 44, justifyContent: "center" },
});
