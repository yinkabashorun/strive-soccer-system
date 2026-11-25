import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Linking, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAPTION_MAX, KINDS, LOG_CHIPS, POST_RULES_LINE, chipLabel, lockedLine, type Kind } from "@shared/tracker";
import { POST_SESSION_DETAIL, POST_SESSION_ROW } from "@shared/one-app";
import { CLOCK_MIN_SECONDS, CLOCK_WORDS, TYPED_LINE, clockFace, clockLength, lessApplied, lessMax } from "@shared/training-clock";
import { useMe } from "@/api/queries";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { logTraining, refreshFree, useFeed } from "@/api/free";
import { Avatar } from "@/Avatar";
import { finishClock, retakeFinish, sendClock, startClock, stopClock, storedClock, takeClockNote, useClockView } from "@/clock";
import { cameraFirst, clockView, lessStep, readyMinutes, shotUri } from "@/clock-core";
import { FIXTURES } from "@/config";
import { feel, tick } from "@/feel";
import { FormScreen } from "@/FormScreen";
import { postTraining, type PickedPhoto } from "@/post-api";
import { loadPrefs, setPref, usePrefs } from "@/prefs";
import { turnOnNotifications } from "@/push";
import { Body, Button, Eyebrow, Head, Icon, Label, Press } from "@/ui";
import { color, font } from "@/theme";

// TRAINING, TIMED BETWEEN TWO PHOTOS (Coach Yinka, Nov 25 2026: "a pic
// when they arrive then when they dip", so nobody can just say they
// trained). The rules are lib/elite/training-clock.ts; the clock itself is
// kept on this phone (src/clock.ts), so it runs with no signal and with
// the app closed.
//
//   1. START   one photo, taken right now in the camera, starts the clock.
//   2. RUNNING the clock counts. The player puts the phone down and trains;
//              this screen can be closed and opened again.
//   3. FINISH  one more photo stops it. The time between the two photos is
//              the training: nobody picks or types a length.
//   4. POST    training or gym, one optional line, Post to my friends. With
//              no signal it stays ready on the phone and the same button
//              sends it later.
//
// BOTH PHOTOS COME FROM THE CAMERA, never from the photo library: a photo
// from last week cannot start or stop a clock. (The example build that the
// simulator pictures has no camera, so there, and only there, the phone's
// photos stand in for it.)
//
// "Trained without the clock?" keeps the old way for a session nobody
// timed: the player says how long. It goes on their own week, marked not
// timed, and counts on no board (TYPED_LINE).
//
// A clock that ran past three hours with no finish photo can no longer be
// timed; the player may add that training the typed way.
//
// MADE PRACTICAL (his word, Nov 25 2026):
//   - ONE TAP TO THE CAMERA. A button that says "Start training" or
//     "Finish my training" opens this screen with `go`: the camera opens
//     at once (src/clock-core.ts cameraFirst). The first clock ever shows
//     how it works first. Closing the camera leaves the screen as it is.
//   - A POST SENDS ITSELF. With no signal the post is kept on the phone
//     and the app sends it when it is back online (src/clock.ts).
//   - FORGOT TO STOP THE CLOCK. "Finished before you took this photo?"
//     takes time OFF, five minutes a tap. It can never add time.
//
// Opened from a finished session's "Post it to your friends" (a member
// with the free app: lib/elite/one-app.ts) it carries `session`: only a
// photo and the line are asked. The time is already on the week, counted
// by the server from the session itself.

// Where the note comes to rest under the top of the page once the keyboard
// is up: far enough down that what is above it stays on screen.
const NOTE_REVEAL_TOP = 112;

type Shoot = { photo: PickedPhoto } | { off: true } | { failed: string } | null;

// One photo, taken now. The camera opens only once the phone has said yes
// to it; a no is said plainly with the way to change it.
async function takePhoto(): Promise<Shoot> {
  try {
    let res: ImagePicker.ImagePickerResult;
    if (FIXTURES) {
      // the simulator has no camera: its own photos stand in, there only
      res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    } else {
      const asked = await ImagePicker.requestCameraPermissionsAsync();
      if (!asked.granted) return { off: true };
      res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    }
    const a = res.canceled ? null : res.assets[0];
    return a ? { photo: { uri: a.uri, width: a.width, height: a.height } } : null;
  } catch {
    return { failed: "The camera did not open. Try again." };
  }
}

export default function Post() {
  const { session: sessionParam, go } = useLocalSearchParams<{ session?: string; go?: string }>();
  const session = typeof sessionParam === "string" && /^\d{1,3}-\d{1,2}$/.test(sessionParam) ? sessionParam : null;
  return session ? <SessionPost session={session} /> : <ClockPost go={go === "1"} />;
}

// How long the screen is given to finish opening before the camera is put
// on top of it: iOS refuses to show one screen while another is arriving.
const CAMERA_AFTER_MS = 600;

// ---- the pieces every state shares ---------------------------------------

function CloseBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12 }}>
      <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }} accessibilityLabel="Close">
        <Icon name="close" />
      </Press>
    </View>
  );
}

function CameraOff() {
  return (
    <View style={{ marginTop: 12 }}>
      <Body style={{ color: color.danger }}>{CLOCK_WORDS.cameraOff}</Body>
      <Press onPress={() => void Linking.openSettings()} style={styles.link} accessibilityRole="link">
        <Label size={14}>Open Settings</Label>
      </Press>
    </View>
  );
}

function Kinds({ kind, onPick }: { kind: Kind; onPick: (k: Kind) => void }) {
  return (
    <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="What you are posting">
      {KINDS.map((k) => (
        <Press
          key={k.id}
          style={[styles.kind, kind === k.id ? styles.kindOn : null]}
          onPress={() => {
            tick();
            onPick(k.id);
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: kind === k.id }}
          accessibilityLabel={k.label}
        >
          <Label style={{ color: kind === k.id ? color.bone : color.dim }}>{k.label}</Label>
        </Press>
      ))}
    </View>
  );
}

function Note({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <TextInput
        style={styles.note}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[\r\n]+/g, " "))}
        placeholder="What did you work on?"
        placeholderTextColor={color.faint}
        maxLength={CAPTION_MAX}
        returnKeyType="done"
        accessibilityLabel="One line about your training"
      />
      <Body dim size={12} style={{ marginTop: 10 }}>
        {POST_RULES_LINE}
      </Body>
    </>
  );
}

// The button rides on the keyboard. In the page's own flow it sat BEHIND
// the keyboard while the note was being typed, and a tap aimed at it typed
// a letter (the simulator's first walk of a first post, Nov 25 2026).
// `calm`: the line is not a fault (a post kept safe on the phone), so it
// is not said in red.
function Footer({ error, calm, children }: { error: string | null; calm?: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16, backgroundColor: color.black }}>
      {error ? <Body style={{ color: calm ? color.bone : color.danger, marginBottom: 10 }}>{error}</Body> : null}
      {children}
    </View>
  );
}

// Asked once, after the first post that went up: whether to say when a
// friend posts, with the reason. Nothing else is asked or offered here.
function AskNotifications({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [turningOn, setTurningOn] = useState(false);
  return (
    <View style={[styles.fill, { paddingTop: insets.top + 90, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }]}>
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

function useLeave() {
  const router = useRouter();
  return async () => {
    await refreshFree();
    router.back();
  };
}

// ---- the clock -------------------------------------------------------------

function ClockPost({ go }: { go: boolean }) {
  const insets = useSafeAreaInsets();
  const leave = useLeave();
  const me = useMe();
  const [prefs] = usePrefs();
  const owner = me.data?.viewer.email ?? "";
  const gym = me.data?.free?.gym === true;
  const { clock, view } = useClockView();
  // The friends whose training today opens the moment this is posted:
  // their faces, and the one line the feed's own locked card says. Shown
  // only while today is still locked and a friend has trained; nobody is
  // ever named as not having trained.
  const feed = useFeed().data;
  const waiting = feed && !feed.unlocked && feed.friendsToday > 0 ? feed.faces.filter((f) => !f.you && f.active) : [];

  const [typed, setTyped] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  // a post that is waiting to be sent opens with what was chosen for it
  const [kind, setKind] = useState<Kind>(clock?.post?.kind ?? "training");
  const [caption, setCaption] = useState(clock?.post?.caption ?? "");
  // minutes taken off, when the clock ran on after training ended
  const [less, setLess] = useState(clock?.post?.less ?? 0);
  const [lessOpen, setLessOpen] = useState((clock?.post?.less ?? 0) > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOff, setCameraOff] = useState(false);
  const [asking, setAsking] = useState(false);

  // One photo from the camera, then what to do with it.
  async function shoot(then: (photo: PickedPhoto) => Promise<void>) {
    setError(null);
    setCameraOff(false);
    const shot = await takePhoto();
    if (!shot) return;
    if ("off" in shot) return setCameraOff(true);
    if ("failed" in shot) return setError(shot.failed);
    setBusy(true);
    try {
      await then(shot.photo);
      feel("drill");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That photo could not be used. Take another one.");
    } finally {
      setBusy(false);
    }
  }

  const start = () => shoot((photo) => startClock(owner, photo));

  function finish() {
    if (view.at === "running" && view.seconds < CLOCK_MIN_SECONDS) return setError(CLOCK_WORDS.tooSoon);
    void shoot(finishClock);
  }

  // ONE TAP TO THE CAMERA: opened by a button that already said what it
  // does, the camera comes up by itself, once. Read from the stored clock
  // and settings, not from this render, so a clock still being read from
  // the phone is never mistaken for no clock.
  const went = useRef(false);
  useEffect(() => {
    if (!go || !owner || went.current) return;
    went.current = true;
    let live = true;
    const t = setTimeout(() => {
      void Promise.all([storedClock(), loadPrefs()]).then(([c, p]) => {
        if (!live) return;
        const mine = c && c.owner === owner.toLowerCase() ? c : null;
        const to = cameraFirst(clockView(mine, Date.now()), p.clockKnown, CLOCK_MIN_SECONDS);
        if (to === "start") void shoot((photo) => startClock(owner, photo));
        if (to === "finish") void shoot(finishClock);
      });
    }, CAMERA_AFTER_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // once, when the account is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, owner]);

  // a post that is waiting to be sent shows what was chosen for it
  const waitingFor = clock?.post ? clock.start.atMs : null;
  useEffect(() => {
    const p = clock?.post;
    if (!p) return;
    setKind(p.kind);
    setCaption(p.caption);
    setLess(p.less);
    setLessOpen(p.less > 0);
    // only when a waiting post appears, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingFor]);

  // why a waiting post was let go of, said once
  useEffect(() => {
    void takeClockNote().then((note) => note && setError(note));
  }, []);

  function stop() {
    Alert.alert(CLOCK_WORDS.cancel, CLOCK_WORDS.cancelAsk, [
      { text: "Keep training", style: "cancel" },
      { text: CLOCK_WORDS.cancel, style: "destructive", onPress: () => void stopClock().then(() => setError(null)) },
    ]);
  }

  async function post() {
    setError(null);
    setBusy(true);
    const res = await sendClock(kind, caption, less);
    setBusy(false);
    // A refusal that is final cleared the clock: the start screen says why.
    // A post kept for later says so calmly, under "Ready to post" (the
    // footer reads it off the clock itself).
    if (!res.ok) return setError(!res.final && res.message === CLOCK_WORDS.kept ? null : res.message);
    feel("drill");
    // asked once, after the first post that went up
    if (!prefs.pushAsked) {
      void refreshFree();
      return setAsking(true);
    }
    await leave();
  }

  async function addTyped() {
    if (minutes === null) return;
    setError(null);
    setBusy(true);
    try {
      const res = await logTraining(minutes, kind);
      if (!res.ok) throw new ApiError(400, null, res.error ?? "Your time was not saved. Try again.");
      feel("drill");
      await leave();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (asking) return <AskNotifications onDone={() => void leave()} />;

  // ---- said how long, without the clock ----
  if (typed) {
    return (
      <FormScreen
        header={<CloseBar />}
        contentStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        footer={
          <Footer error={error}>
            <Button label={CLOCK_WORDS.typedButton} busy={busy} disabled={minutes === null} onPress={() => void addTyped()} />
          </Footer>
        }
      >
        <Head size={36} style={{ marginTop: 18 }}>
          {CLOCK_WORDS.typedHead}
        </Head>
        <Body dim style={{ marginTop: 10 }}>
          {TYPED_LINE}
        </Body>
        {gym ? <Kinds kind={kind} onPick={setKind} /> : null}
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="How long">
          {LOG_CHIPS.map((m) => (
            <Press
              key={m}
              style={[styles.chip, minutes === m ? styles.chipOn : null]}
              onPress={() => {
                tick();
                setMinutes(m);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: minutes === m }}
              accessibilityLabel={chipLabel(m)}
            >
              {/* small enough that "1h 30m" fits its chip on the narrowest phone */}
              <Head size={19} numberOfLines={1} style={{ color: minutes === m ? color.black : color.bone, textTransform: "none", letterSpacing: 0 }}>
                {chipLabel(m)}
              </Head>
            </Press>
          ))}
        </View>
        {view.at === "none" ? (
          <Press
            onPress={() => {
              setError(null);
              setTyped(false);
            }}
            disabled={busy}
            style={[styles.link, { alignSelf: "center", marginTop: 14 }]}
          >
            <Label dim size={14}>
              {CLOCK_WORDS.backToClock}
            </Label>
          </Press>
        ) : null}
      </FormScreen>
    );
  }

  // ---- both photos taken: ready to post ----
  if (clock && clock.finish && view.at === "ready") {
    const startUri = shotUri(clock.start);
    const finishUri = shotUri(clock.finish);
    // the time between the photos, and what it counts with time taken off
    const measured = readyMinutes(clock);
    const counted = lessApplied(measured, less);
    return (
      <FormScreen
        header={<CloseBar />}
        contentStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        // the note comes to rest with the time still in view above it
        revealTop={NOTE_REVEAL_TOP}
        footer={
          <Footer error={error ?? (view.waiting ? `${CLOCK_WORDS.kept} ${CLOCK_WORDS.waiting}` : null)} calm={!error || error === CLOCK_WORDS.kept}>
            <Button label={CLOCK_WORDS.post} busy={busy} onPress={() => void post()} />
          </Footer>
        }
      >
        <View style={styles.preview}>
          {finishUri ? <Image source={{ uri: finishUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Your finish photo" /> : null}
          {startUri ? (
            <View style={styles.inset}>
              <Image source={{ uri: startUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Your start photo" />
            </View>
          ) : null}
        </View>
        <View accessible accessibilityLabel={`${CLOCK_WORDS.ready}. ${clockLength(counted)}. ${CLOCK_WORDS.between}`}>
          <Eyebrow style={{ marginTop: 18 }}>{CLOCK_WORDS.ready}</Eyebrow>
          <Head size={54} style={{ marginTop: 4, textTransform: "none" }}>
            {clockLength(counted)}
          </Head>
          <Body dim size={13.5} style={{ marginTop: 2 }}>
            {less > 0 ? CLOCK_WORDS.lessBody : CLOCK_WORDS.between}
          </Body>
        </View>
        {/* Forgot to stop the clock: time comes OFF, five minutes a tap. */}
        {lessOpen ? (
          <View style={styles.less}>
            <Press
              onPress={() => {
                tick();
                setLess(lessStep(measured, less, -1));
              }}
              disabled={busy || less >= lessMax(measured)}
              style={styles.lessButton}
              accessibilityLabel={CLOCK_WORDS.lessMinus}
            >
              <Label size={14}>{CLOCK_WORDS.lessMinus}</Label>
            </Press>
            <Press
              onPress={() => {
                tick();
                setLess(lessStep(measured, less, 1));
              }}
              disabled={busy || less === 0}
              style={styles.lessButton}
              accessibilityLabel={CLOCK_WORDS.lessPlus}
            >
              <Label size={14}>{CLOCK_WORDS.lessPlus}</Label>
            </Press>
          </View>
        ) : lessMax(measured) > 0 ? (
          <Press onPress={() => setLessOpen(true)} disabled={busy} style={styles.link} accessibilityLabel={CLOCK_WORDS.lessLink}>
            <Label dim size={14}>
              {CLOCK_WORDS.lessLink}
            </Label>
          </Press>
        ) : null}
        {gym ? <Kinds kind={kind} onPick={setKind} /> : null}
        <Note value={caption} onChange={setCaption} />
        <Press
          onPress={() => {
            setError(null);
            setLess(0);
            setLessOpen(false);
            void retakeFinish();
          }}
          disabled={busy}
          style={[styles.link, { alignSelf: "center", marginTop: 10 }]}
        >
          <Label dim size={14}>
            {CLOCK_WORDS.retake}
          </Label>
        </Press>
      </FormScreen>
    );
  }

  // ---- ran too long with no finish photo ----
  if (view.at === "expired") {
    return (
      <FormScreen header={<CloseBar />} contentStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Head size={36} style={{ marginTop: 12 }}>
          {CLOCK_WORDS.expiredHead}
        </Head>
        <Body dim style={{ marginTop: 10 }}>
          {CLOCK_WORDS.expiredBody}
        </Body>
        <View style={{ gap: 10, marginTop: 24 }}>
          <Button
            label={CLOCK_WORDS.typedButton}
            onPress={() => {
              setError(null);
              void stopClock().then(() => setTyped(true));
            }}
          />
          <Button quiet label={CLOCK_WORDS.skip} onPress={() => void stopClock()} />
        </View>
      </FormScreen>
    );
  }

  // ---- the clock is running ----
  if (clock && (view.at === "running" || view.at === "capped")) {
    const startUri = shotUri(clock.start);
    const face = clockFace(view.seconds);
    return (
      <FormScreen header={<CloseBar />} contentStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.clock} accessible accessibilityRole="timer" accessibilityLabel={`${CLOCK_WORDS.running}. ${face}`}>
          {startUri ? (
            <View style={styles.startThumb}>
              <Image source={{ uri: startUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Your start photo" />
            </View>
          ) : null}
          <Eyebrow style={{ marginTop: 18 }}>{CLOCK_WORDS.running}</Eyebrow>
          <Head size={84} style={styles.face}>
            {face}
          </Head>
        </View>
        <Body dim style={{ marginTop: 6, textAlign: "center" }}>
          {view.at === "capped" ? CLOCK_WORDS.capped : CLOCK_WORDS.runningBody}
        </Body>
        {view.at === "running" ? (
          <Body dim size={12.5} style={{ marginTop: 8, textAlign: "center" }}>
            {CLOCK_WORDS.cap}
          </Body>
        ) : null}
        <View style={{ marginTop: 26 }}>
          <Button label={CLOCK_WORDS.finish} busy={busy} onPress={finish} />
        </View>
        {cameraOff ? <CameraOff /> : null}
        {error ? <Body style={{ color: color.danger, marginTop: 12, textAlign: "center" }}>{error}</Body> : null}
        <Press onPress={stop} disabled={busy} style={[styles.link, { alignSelf: "center", marginTop: 14 }]} accessibilityLabel={CLOCK_WORDS.cancel}>
          <Label dim size={14}>
            {CLOCK_WORDS.cancel}
          </Label>
        </Press>
      </FormScreen>
    );
  }

  // ---- no clock yet: the start photo ----
  return (
    <FormScreen header={<CloseBar />} contentStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
      <Head size={36} style={{ marginTop: 12 }}>
        {CLOCK_WORDS.startHead}
      </Head>
      <Body dim style={{ marginTop: 10 }}>
        {CLOCK_WORDS.startBody}
      </Body>
      {waiting.length && feed ? (
        <View style={styles.waiting} accessible accessibilityLabel={lockedLine(feed.friendsToday)}>
          <View style={{ flexDirection: "row" }}>
            {waiting.slice(0, 4).map((f, i) => (
              <View key={f.id} style={{ marginLeft: i === 0 ? 0 : -12 }}>
                <Avatar uri={f.photo} initials={f.initials} size={40} ring />
              </View>
            ))}
          </View>
          <Body size={13.5} style={{ flex: 1 }}>
            {lockedLine(feed.friendsToday)}
          </Body>
        </View>
      ) : null}
      <View style={{ marginTop: 24 }}>
        <Button label={CLOCK_WORDS.startButton} busy={busy} disabled={!owner} onPress={() => void start()} />
      </View>
      {cameraOff ? <CameraOff /> : null}
      {error ? <Body style={{ color: color.danger, marginTop: 12 }}>{error}</Body> : null}
      <Press
        onPress={() => {
          setError(null);
          setCameraOff(false);
          setTyped(true);
        }}
        disabled={busy}
        style={[styles.link, { alignSelf: "center", marginTop: 14 }]}
        accessibilityLabel={CLOCK_WORDS.typedLink}
      >
        <Label dim size={14}>
          {CLOCK_WORDS.typedLink}
        </Label>
      </Press>
    </FormScreen>
  );
}

// ---- a finished Strive Pro session: one photo and the line ----------------

function SessionPost({ session }: { session: string }) {
  const insets = useSafeAreaInsets();
  const leave = useLeave();
  const [prefs] = usePrefs();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOff, setCameraOff] = useState(false);
  const [asking, setAsking] = useState(false);

  async function shoot() {
    setError(null);
    setCameraOff(false);
    const shot = await takePhoto();
    if (!shot) return;
    if ("off" in shot) return setCameraOff(true);
    if ("failed" in shot) return setError(shot.failed);
    setPhoto(shot.photo);
  }

  async function send() {
    if (!photo) return;
    setError(null);
    setBusy(true);
    try {
      await postTraining({ photo, session, caption });
      feel("drill");
      if (!prefs.pushAsked) {
        void refreshFree();
        return setAsking(true);
      }
      await leave();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (asking) return <AskNotifications onDone={() => void leave()} />;

  if (!photo) {
    return (
      <FormScreen header={<CloseBar />} contentStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Head size={36} style={{ marginTop: 12 }}>
          {POST_SESSION_ROW}
        </Head>
        <Body dim style={{ marginTop: 10 }}>
          {POST_SESSION_DETAIL}
        </Body>
        <View style={{ marginTop: 24 }}>
          <Button label="Take a photo" onPress={() => void shoot()} />
        </View>
        {cameraOff ? <CameraOff /> : null}
        {error ? <Body style={{ color: color.danger, marginTop: 12 }}>{error}</Body> : null}
      </FormScreen>
    );
  }

  return (
    <FormScreen
      header={<CloseBar />}
      contentStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
      revealTop={NOTE_REVEAL_TOP}
      footer={
        <Footer error={error}>
          <Button label={CLOCK_WORDS.post} busy={busy} onPress={() => void send()} />
        </Footer>
      }
    >
      <View style={styles.preview}>
        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Your training photo" />
      </View>
      <Head size={36} style={{ marginTop: 18 }}>
        Your session, your photo
      </Head>
      <Body dim style={{ marginTop: 10 }}>
        Your time is already on your week.
      </Body>
      <Note value={caption} onChange={setCaption} />
      <Press
        onPress={() => {
          setPhoto(null);
          setError(null);
        }}
        disabled={busy}
        style={[styles.link, { alignSelf: "center", marginTop: 10 }]}
      >
        <Label dim size={14}>
          Take another photo
        </Label>
      </Press>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  waiting: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 22, padding: 14, borderRadius: 18, backgroundColor: color.fill2 },
  fill: { flex: 1, backgroundColor: color.black },
  preview: { width: "62%", alignSelf: "center", aspectRatio: 4 / 5, borderRadius: 24, overflow: "hidden", backgroundColor: color.fill2, marginTop: 6 },
  // the start photo, small, in the corner of the finish photo
  inset: { position: "absolute", left: 10, top: 10, width: "34%", aspectRatio: 4 / 5, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: color.black, backgroundColor: color.fill2 },
  clock: { alignItems: "center", marginTop: 18 },
  startThumb: { width: 96, height: 120, borderRadius: 18, overflow: "hidden", backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line },
  // every digit the same width, so the clock does not shake as it counts
  face: { marginTop: 4, fontVariant: ["tabular-nums"], textTransform: "none" },
  link: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  less: { flexDirection: "row", gap: 10, marginTop: 10 },
  lessButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  kinds: { flexDirection: "row", marginTop: 18, padding: 4, borderRadius: 16, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line },
  kind: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  kindOn: { backgroundColor: "#2b2b2b" },
  chips: { flexDirection: "row", gap: 8, marginTop: 18 },
  chip: { flex: 1, minHeight: 64, borderRadius: 18, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line, alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: color.bone, borderColor: color.bone },
  note: { marginTop: 14, minHeight: 54, borderRadius: 16, backgroundColor: color.fill2, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
});
