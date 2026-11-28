import { useEffect, useRef, useState } from "react";
import { Linking, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QUOTES, quoteById } from "@shared/quotes";
import {
  CARD_POINTS,
  CARD_WORDS,
  cardButtons,
  cardFace,
  cardKey,
  cardTitle,
  rememberSaved,
  savedAlready,
  type CardButton,
} from "@shared/session-card";
import { seedDay } from "@shared/voice";
import { useMe } from "@/api/queries";
import { refreshFree, useFreeYou } from "@/api/free";
import { AskNotifications } from "@/AskNotifications";
import { cardSource, exampleCardSource, forgetCardSource } from "@/card-source";
import { instagramReady, makeCardFile, saveCard, shareMore, shareToStory } from "@/card-native";
import { FIXTURES, META_APP_ID } from "@/config";
import { feel, tick } from "@/feel";
import { homeOf } from "@/navigation";
import { loadPrefs, prefsNow, setPref } from "@/prefs";
import { useBelowClock } from "@/Screen";
import { SessionCard, type CardView } from "@/SessionCard";
import { Body, Button, Card, Eyebrow, Hairline, Head, Icon, Label, Press, SettingRow } from "@/ui";
import { color } from "@/theme";

// YOUR CARD (Coach Yinka, Nov 28 2026: "the card is like strava you
// complete your session and take the picture with text over it"). Opened
// straight after a post goes up (the training clock's post, and the photo
// on a finished Strive Pro session, app/post.tsx), and later from your own
// post with "Make my card" (the feed's menu, your photos on You).
//
// The card is drawn here from the post's own photo (src/SessionCard.tsx;
// what is on it is lib/elite/session-card.ts cardFace), shown scaled to
// fit. A quote is one tap away. Instagram story, Save to Photos, More.
//
// EVERY SHARE ALSO SAVES THE CARD TO PHOTOS ("every time you post it must
// save to camera roll"), once per card version: the same photo with the
// same quote is never saved twice (the versions kept on this phone,
// prefs.cardsSaved). The iPhone asks for add-only access at the first save
// with our sentence (app.json NSPhotoLibraryAddUsageDescription). A no
// never stops the share: one plain line says the card was not saved, with
// Open Settings.
//
// Close is one tap and loses nothing: the post is already up. Straight
// after a first post, the notifications ask that used to follow the post
// follows the card (src/AskNotifications.tsx), once.
//
// The example build (the simulator, the browser preview) opens the card
// from one of our own stills and never captures, saves or shares: each
// button only shows the line a saved card shows.

export default function CardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const { width, height } = useWindowDimensions();
  const me = useMe();
  const you = useFreeYou().data;
  const [src] = useState(() => cardSource() ?? (FIXTURES ? exampleCardSource(seedDay()) : null));
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [ready, setReady] = useState(false);
  const [instagram, setInstagram] = useState(false);
  const [busy, setBusy] = useState<CardButton | null>(null);
  const [note, setNote] = useState<{ text: string; settings?: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const cardRef = useRef<CardView>(null);
  // one picture per card version: sharing twice does not capture twice
  const made = useRef<{ key: string; file: string } | null>(null);

  const leave = async () => {
    forgetCardSource();
    await refreshFree();
    if (router.canGoBack()) router.back();
    else router.replace(homeOf(me.data?.state) as Href);
  };

  // nothing to make a card from (the app was reopened on this screen)
  useEffect(() => {
    if (!src) void leave();
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (FIXTURES) return;
    void instagramReady().then(setInstagram);
  }, []);

  if (!src) return <View style={{ flex: 1, backgroundColor: color.black }} />;
  if (asking) return <AskNotifications onDone={() => void leave()} />;

  // the numbers the You tab shows, from the same answer; left off when the
  // phone never had them
  const stats = you ? { weekMinutes: you.weekMinutes, allMinutes: you.allMinutes, level: you.aura.level } : null;
  const name = you?.name ?? me.data?.free?.name ?? "";
  const face = cardFace({ day: src.day, today: seedDay(), name, minutes: src.minutes, kind: src.kind, note: src.note, quoteId, stats });
  const buttons = cardButtons({ instagram, metaAppId: META_APP_ID });
  const quote = quoteById(quoteId);

  // the card, scaled to fit what is left of the screen: just over half its
  // height, so the quote row and two buttons sit under it without a scroll
  // (at 0.6 the simulator's first picture had the last button off the screen)
  const scale = Math.min((width - 40) / CARD_POINTS.width, (height * 0.52) / CARD_POINTS.height);
  const shown = { width: CARD_POINTS.width * scale, height: CARD_POINTS.height * scale };

  function close() {
    if (src?.askAfter && !prefsNow().pushAsked) {
      forgetCardSource();
      return setAsking(true);
    }
    void leave();
  }

  async function picture(key: string): Promise<string> {
    if (made.current?.key === key) return made.current.file;
    const file = await makeCardFile(cardRef);
    made.current = { key, file };
    return file;
  }

  // Saved once per version. "already": this phone saved this card before.
  async function saveOnce(key: string, file: string) {
    const p = await loadPrefs();
    const saved = Array.isArray(p.cardsSaved) ? p.cardsSaved : [];
    if (savedAlready(saved, key)) return "already" as const;
    const r = await saveCard(file);
    if (r === "saved") await setPref("cardsSaved", rememberSaved(saved, key));
    return r;
  }

  async function run(which: CardButton) {
    if (busy || !src) return;
    tick();
    setNote(null);
    // the example build captures, saves and shares nothing
    if (FIXTURES) return setNote({ text: CARD_WORDS.saved });
    // a card is never made without its photo on it
    if (!ready) return setNote({ text: CARD_WORDS.failed });
    setBusy(which);
    try {
      const key = cardKey(src.key, quoteId);
      const file = await picture(key);
      const saved = await saveOnce(key, file);
      if (saved === "refused") setNote({ text: CARD_WORDS.notSaved, settings: true });
      else if (saved === "saved" || saved === "already") setNote({ text: CARD_WORDS.saved });
      else if (which === "save") setNote({ text: CARD_WORDS.failed });
      if (saved === "saved") feel("drill");
      // Instagram that will not open falls back to the share sheet
      if (which === "instagram" && META_APP_ID) await shareToStory(file, META_APP_ID).catch(() => shareMore(file));
      if (which === "more") await shareMore(file);
    } catch {
      setNote({ text: CARD_WORDS.failed });
    } finally {
      setBusy(null);
    }
  }

  const label: Record<CardButton, string> = { instagram: CARD_WORDS.instagram, save: CARD_WORDS.save, more: CARD_WORDS.more };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView style={[{ flex: 1 }, belowClock]} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        <View style={styles.bar}>
          <Press onPress={close} style={styles.close} accessibilityLabel={CARD_WORDS.close}>
            <Icon name="close" />
          </Press>
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <Eyebrow>{CARD_WORDS.eyebrow}</Eyebrow>
          <Head size={32} style={{ marginTop: 4 }}>
            {cardTitle(`${me.data?.viewer.email ?? ""}:${src.key}`)}
          </Head>
        </View>

        <View style={[styles.frame, shown]}>
          <View style={{ position: "absolute", width: CARD_POINTS.width, height: CARD_POINTS.height, left: (shown.width - CARD_POINTS.width) / 2, top: (shown.height - CARD_POINTS.height) / 2, transform: [{ scale }] }}>
            <SessionCard cardRef={cardRef} face={face} photo={src.photo} onReady={setReady} />
          </View>
        </View>

        <Card style={{ marginHorizontal: 20, marginTop: 18, padding: 0 }}>
          <SettingRow label={quote ? CARD_WORDS.quoteChange : CARD_WORDS.quoteRow} detail={quote ? quote.by : undefined} onPress={() => setPicking(true)} />
        </Card>

        <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 10 }}>
          {buttons.map((b) => (
            <Button key={b} label={label[b]} busy={busy === b} disabled={busy !== null && busy !== b} onPress={() => void run(b)} />
          ))}
          {note ? (
            <View accessibilityLiveRegion="polite">
              <Body dim size={13.5}>
                {note.text}
              </Body>
              {note.settings ? (
                <Press onPress={() => void Linking.openSettings()} style={styles.link} accessibilityRole="link">
                  <Label size={14}>{CARD_WORDS.openSettings}</Label>
                </Press>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: color.fill }}>
          <View style={styles.sheetHead}>
            <Head size={24}>{CARD_WORDS.quoteSheet}</Head>
            <Press onPress={() => setPicking(false)} style={styles.close} accessibilityLabel={CARD_WORDS.close}>
              <Icon name="close" />
            </Press>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            {[null, ...QUOTES].map((q, i) => {
              const id = q?.id ?? null;
              const on = id === quoteId;
              return (
                <View key={id ?? "none"}>
                  {i > 0 ? <Hairline /> : null}
                  <Press
                    onPress={() => {
                      tick();
                      setQuoteId(id);
                      setNote(null);
                      setPicking(false);
                    }}
                    style={styles.option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={q ? `${q.text} ${q.by}` : CARD_WORDS.quoteNone}
                  >
                    <View style={{ flex: 1 }}>
                      {q ? (
                        <>
                          <Body size={15}>{q.text}</Body>
                          <Eyebrow style={{ marginTop: 6 }}>{q.by}</Eyebrow>
                        </>
                      ) : (
                        <Label>{CARD_WORDS.quoteNone}</Label>
                      )}
                    </View>
                    {on ? <Icon name="check" size={18} /> : null}
                  </Press>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, paddingTop: 6 },
  close: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  frame: { alignSelf: "center", marginTop: 16, borderRadius: 22, overflow: "hidden", backgroundColor: color.fill2 },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 8, paddingTop: 14, paddingBottom: 8 },
  option: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
});
