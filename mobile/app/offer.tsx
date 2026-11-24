import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMe } from "@/api/queries";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { confirmUpgrade, rereadMe, startUpgrade, useOffer } from "@/api/free";
import { MemberCard } from "@/MemberCard";
import { openLink, openSite } from "@/links";
import { useMyPhoto } from "@/usePhoto";
import { Body, Button, Eyebrow, Head, Icon, Label, Press, Skeleton } from "@/ui";
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
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {first ? (
          <View style={{ height: 20 }} />
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
            <Head size={30} style={{ marginHorizontal: 20, marginTop: 24 }}>
              {o.headline}
            </Head>

            {o.drills.length ? (
              <>
                <Eyebrow style={{ marginHorizontal: 20, marginTop: 24 }}>{o.drillsLabel}</Eyebrow>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.drills}>
                  {o.drills.map((d) => (
                    <View key={d.title} style={styles.drill} accessible accessibilityLabel={d.title}>
                      <Image source={{ uri: d.poster }} style={styles.still} contentFit="cover" transition={200} cachePolicy="disk" />
                      <Label size={13} numberOfLines={2} style={{ marginTop: 8 }}>
                        {d.title}
                      </Label>
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
        <View style={[styles.foot, { paddingBottom: insets.bottom + 10 }]}>
          <Label size={16} style={{ textAlign: "center" }}>
            {o.price}
          </Label>
          {error ? (
            <Body size={13.5} style={{ color: color.danger, textAlign: "center", marginTop: 8 }}>
              {error}
            </Body>
          ) : null}
          <Button style={{ marginTop: 12 }} label={o.start} busy={busy} onPress={() => void start()} />
          <Press onPress={later} disabled={busy} style={styles.later} accessibilityLabel={o.later}>
            <Label dim size={15}>
              {o.later}
            </Label>
          </Press>
          <Body dim size={11.5} style={{ textAlign: "center" }}>
            {o.terms}
          </Body>
          <View style={styles.links}>
            <Press onPress={() => void openSite("/terms")} style={styles.link} accessibilityRole="link">
              <Label dim size={12}>Terms of Service</Label>
            </Press>
            <Press onPress={() => void openSite("/privacy")} style={styles.link} accessibilityRole="link">
              <Label dim size={12}>Privacy Policy</Label>
            </Press>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, justifyContent: "center", marginLeft: 16, marginBottom: 4 },
  drills: { paddingHorizontal: 20, gap: 10, marginTop: 12 },
  drill: { width: 124 },
  still: { width: 124, height: 156, borderRadius: 16, backgroundColor: color.fill2 },
  get: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  foot: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.12)", backgroundColor: color.black },
  later: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 2 },
  links: { flexDirection: "row", justifyContent: "center", gap: 18 },
  link: { minHeight: 44, justifyContent: "center" },
});
