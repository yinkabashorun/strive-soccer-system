import { useEffect, useState } from "react";
import { CLUB_GAMES_IN_APP } from "@shared/club-games";
import { Alert, Share, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PlanCard } from "@shared/app-contract";
import { clubShareText } from "@shared/club-app";
import { OPEN_TO_GAMES_LINE, planScore, planSides } from "@shared/club-teams";
import { fmtDuration } from "@shared/time-trained";
import { CLUB_NAME_MAX } from "@shared/tracker";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import {
  answerGame,
  answerJoinRequest,
  answerScore,
  endClub,
  enterScore,
  newClubLink,
  refreshClubs,
  removeMember,
  renameClub,
  setClubCounty,
  useClub,
} from "@/api/clubs";
import { Avatar } from "@/Avatar";
import { API_BASE } from "@/config";
import { CountyPicker } from "@/CountyPicker";
import { Crest } from "@/Crest";
import { tick } from "@/feel";
import { FormScreen } from "@/FormScreen";
import { withPlayTerms } from "@/play-terms";
import { choose } from "@/sheet";
import { Body, Button, Card, Hairline, Head, Icon, Label, Press, SettingRow, Skeleton } from "@/ui";
import { color, font } from "@/theme";

// Manage: the captain's tools, behind one row so the club's page stays
// calm. Each is the website's own action on the server, which checks
// again that the caller is this club's captain.
//   WAITING ON YOU  players asking to join (Let in, Decline), a game
//                   another club sent (Accept, Pass), a score to enter, a
//                   score the other captain entered (Confirm, Not right)
//   PLAN            a session for the club, or a game against a club near you
//   THE CLUB        its name, its county and "Open to games", a new code,
//                   take a player off (for good), end the club
export default function Manage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = useClub(id);
  const c = club.data;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  // Not this club's captain (or not any more): this screen is not theirs.
  const notCaptain = Boolean(c && !c.captain);
  useEffect(() => {
    if (notCaptain) router.back();
  }, [notCaptain, router]);

  async function act(key: string, run: () => Promise<{ ok: boolean; error?: string; declined?: boolean; code?: string }>, after?: (code?: string) => void) {
    setError(null);
    setBusy(key);
    try {
      const res = await run();
      if (res.ok) {
        await refreshClubs();
        after?.(res.code);
      } else if (!res.declined) setError(res.error ?? "That did not go through. Try again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(null);
    }
  }

  if (!c || !c.captain) {
    return (
      <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20 }}>
        <Back onPress={() => router.back()} />
        {club.isError || club.isPaused ? (
          <View style={{ marginTop: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={club.isFetching} onPress={() => void club.refetch()} />
          </View>
        ) : (
          <Skeleton height={220} style={{ marginTop: 20 }} />
        )}
      </FormScreen>
    );
  }

  const requests = c.manage?.requests ?? [];
  const games = c.manage?.games ?? [];
  const toEnter = c.results.filter((p) => p.result?.canEnter);
  const toAnswer = c.results.filter((p) => p.result?.canAnswer);
  const waiting = requests.length + games.length + toEnter.length + toAnswer.length;
  const others = c.members.filter((m) => !m.you);

  const takeOff = () =>
    choose({
      title: "Take a player off",
      message: "The club's code will not let them back in. They stay friends with everyone they made friends with here.",
      choices: others.map((m) => ({
        label: m.name,
        destructive: true,
        run: () =>
          Alert.alert(`Take ${m.name} off ${c.name}?`, "This is for good: the club's code will not let them back in.", [
            { text: "Cancel", style: "cancel" },
            { text: "Take them off", style: "destructive", onPress: () => void act("remove", () => removeMember(c.id, m.id)) },
          ]),
      })),
    });

  const newCode = () =>
    Alert.alert("Make a new code?", "The old code and link stop working for everyone who has them. Your members stay in the club.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Make a new code",
        onPress: () =>
          void act(
            "link",
            () => newClubLink(c.id),
            (code) => code && void Share.share({ message: clubShareText({ name: c.name, code, appUrl: API_BASE }) }).catch(() => undefined)
          ),
      },
    ]);

  const end = () =>
    Alert.alert("End the club?", "Nobody new can join. The friends everyone made stay friends.", [
      { text: "Cancel", style: "cancel" },
      { text: "End the club", style: "destructive", onPress: () => void act("end", () => endClub(c.id), () => router.back()) },
    ]);

  return (
    <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 48 }}>
      <Back onPress={() => router.back()} />
      <Head size={40} style={{ marginTop: 8 }}>
        Manage
      </Head>
      <Body dim size={13.5} style={{ marginTop: 6 }}>
        {c.name}
      </Body>
      {error ? (
        <Body size={13.5} style={{ color: color.danger, marginTop: 12 }}>
          {error}
        </Body>
      ) : null}

      {waiting ? (
        <Section title="Waiting on you">
          {requests.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Hairline /> : null}
              <View style={[styles.ask, { alignItems: "flex-start", paddingVertical: 14 }]}>
                <Avatar initials={r.initials} size={40} />
                <View style={{ flex: 1 }}>
                  <Label>{`${r.name} wants to join your club`}</Label>
                  <View style={styles.answers}>
                    <Answer label="Decline" says={`Decline ${r.name}`} onPress={() => void act(`r${r.id}`, () => answerJoinRequest(c.id, r.id, false))} />
                    <Answer main label="Let in" says={`Let ${r.name} in`} onPress={() => void act(`r${r.id}`, () => answerJoinRequest(c.id, r.id, true))} />
                  </View>
                </View>
              </View>
            </View>
          ))}
          {games.map((g, i) => (
            <View key={g.id}>
              {i > 0 || requests.length ? <Hairline /> : null}
              <View style={[styles.ask, { alignItems: "flex-start", paddingVertical: 14 }]}>
                <Crest club={{ id: g.fromId, name: g.from }} size={40} />
                <View style={{ flex: 1 }}>
                  <Label>{`${g.from} wants a game`}</Label>
                  <Body dim size={13}>
                    {`${g.when} · ${fmtDuration(g.minutes)}`}
                  </Body>
                  <Body dim size={13}>
                    {g.place}
                  </Body>
                  <View style={styles.answers}>
                    <Answer label="Pass" says={`Pass on the game with ${g.from}`} onPress={() => void act(`g${g.id}`, () => answerGame(g.id, false))} />
                    <Answer main label="Accept" says={`Accept the game with ${g.from}`} onPress={() => void act(`g${g.id}`, () => withPlayTerms(() => answerGame(g.id, true)))} />
                  </View>
                </View>
              </View>
            </View>
          ))}
          {toAnswer.map((p, i) => (
            <View key={p.id}>
              {i > 0 || requests.length || games.length ? <Hairline /> : null}
              <ScoreToAnswer card={p} clubId={c.id} act={act} />
            </View>
          ))}
          {toEnter.map((p, i) => (
            <View key={p.id}>
              {i > 0 || requests.length || games.length || toAnswer.length ? <Hairline /> : null}
              <ScoreToEnter card={p} clubId={c.id} busy={busy === `s${p.id}`} act={act} />
            </View>
          ))}
        </Section>
      ) : null}

      {c.ended ? null : (
        <Section title="Plan">
          <SettingRow label="Plan a session" detail="Training for your club. Only your members see it." onPress={() => router.push(`/club/${c.id}/plan` as Href)} />
          {CLUB_GAMES_IN_APP ? (
            <>
              <Hairline />
              <SettingRow label="Plan a game" detail="Against a club in your county that is open to games." onPress={() => router.push(`/club/${c.id}/near` as Href)} />
            </>
          ) : null}
        </Section>
      )}

      <View style={{ marginTop: 26 }}>
        <Label dim size={13} style={{ marginBottom: 8, marginLeft: 4 }}>
          The club
        </Label>
        {name === null ? (
          <Card style={{ padding: 0 }}>
            <SettingRow label="Rename the club" detail={c.name} onPress={() => setName(c.name)} />
          </Card>
        ) : (
          <View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => setName(t.slice(0, CLUB_NAME_MAX))}
              maxLength={CLUB_NAME_MAX}
              placeholder="Club name"
              placeholderTextColor={color.faint}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel="Club name"
            />
            <Button quiet style={{ marginTop: 10 }} label="Save the name" busy={busy === "rename"} disabled={!name.trim()} onPress={() => void act("rename", () => renameClub(c.id, name), () => setName(null))} />
          </View>
        )}

        <View style={{ marginTop: 12 }}>
          <CountyPicker value={c.county} onChange={(county) => void act("county", () => setClubCounty(c.id, county, county ? c.open : false))} />
        </View>
        {/* "Open to games" only while games between clubs are in the app
            (lib/elite/club-games.ts); the server keeps the switch as the
            website left it either way */}
        {CLUB_GAMES_IN_APP ? (
        <Card style={{ padding: 0, marginTop: 12 }}>
          <SettingRow
            label="Open to games"
            value={c.open}
            onValue={(v) => {
              tick();
              void act("open", () => setClubCounty(c.id, c.county, v));
            }}
          />
          <Body dim size={13} style={{ marginHorizontal: 16, marginBottom: 14, marginTop: -6 }}>
            {OPEN_TO_GAMES_LINE}
          </Body>
        </Card>
        ) : null}

        <Card style={{ padding: 0, marginTop: 12 }}>
          {c.ended ? null : (
            <>
              <SettingRow label="Make a new code" detail="The old code and link stop working. Members stay." onPress={newCode} />
              <Hairline />
            </>
          )}
          {others.length ? (
            <>
              <SettingRow label="Take a player off" detail="For good: the club's code will not let them back in." onPress={takeOff} />
              <Hairline />
            </>
          ) : null}
          {c.ended ? null : <SettingRow label="End the club" danger onPress={end} />}
        </Card>
      </View>
    </FormScreen>
  );
}

type Act = (key: string, run: () => Promise<{ ok: boolean; error?: string; declined?: boolean }>, after?: () => void) => Promise<void>;

// The other captain entered a score: it counts unless this captain says no.
function ScoreToAnswer({ card, clubId, act }: { card: PlanCard; clubId: string; act: Act }) {
  const { theirs } = planSides(card, clubId);
  const score = planScore(card, clubId);
  if (!theirs || !score) return null;
  return (
    <View style={[styles.ask, { alignItems: "flex-start", paddingVertical: 14 }]}>
      <Crest club={theirs} size={40} />
      <View style={{ flex: 1 }}>
        <Label>{`Your club ${score[0]}, ${theirs.name} ${score[1]}`}</Label>
        {card.result?.line ? (
          <Body dim size={13}>
            {card.result.line}
          </Body>
        ) : null}
        <View style={styles.answers}>
          <Answer label="Not right" says="The score is not right" onPress={() => void act(`a${card.id}`, () => answerScore(card.id, false))} />
          <Answer main label="Confirm" says="Confirm the score" onPress={() => void act(`a${card.id}`, () => answerScore(card.id, true))} />
        </View>
      </View>
    </View>
  );
}

// A game that has started and has no score yet: either captain enters it,
// with two steppers (no keyboard), their own club's score first.
function ScoreToEnter({ card, clubId, busy, act }: { card: PlanCard; clubId: string; busy: boolean; act: Act }) {
  const { ours, theirs } = planSides(card, clubId);
  const [mine, setMine] = useState(0);
  const [other, setOther] = useState(0);
  if (!theirs) return null;
  // the server takes the organizing club's score first
  const organized = ours.id === card.organizer.id;
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
      <Label>{`The score against ${theirs.name}`}</Label>
      <Body dim size={13}>
        {`${card.when}. The other captain confirms it.`}
      </Body>
      <View style={styles.scores}>
        <Stepper label="Your club" value={mine} onChange={setMine} />
        <Stepper label={theirs.name} value={other} onChange={setOther} />
      </View>
      <Button quiet style={{ marginTop: 12 }} label="Save the score" busy={busy} onPress={() => void act(`s${card.id}`, () => enterScore(card.id, organized ? mine : other, organized ? other : mine))} />
    </View>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const step = (by: number) => {
    tick();
    onChange(Math.max(0, Math.min(99, value + by)));
  };
  return (
    <View style={{ flex: 1 }} accessible={false}>
      <Body dim size={12.5} numberOfLines={1}>
        {label}
      </Body>
      <View style={styles.stepper}>
        <Press onPress={() => step(-1)} disabled={value <= 0} style={styles.step} accessibilityLabel={`${label}: one less`}>
          <View style={styles.minus} />
        </Press>
        <Head size={30} style={{ flex: 1, textAlign: "center" }}>
          {value}
        </Head>
        <Press onPress={() => step(1)} disabled={value >= 99} style={styles.step} accessibilityLabel={`${label}: one more`}>
          <Icon name="plus" size={18} />
        </Press>
      </View>
    </View>
  );
}

function Answer({ label, says, main, onPress }: { label: string; says: string; main?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={[styles.answer, main ? styles.answerMain : null]} accessibilityLabel={says}>
      <Label size={14} dim={!main} style={main ? { color: color.black } : null}>
        {label}
      </Label>
    </Press>
  );
}

function Back({ onPress }: { onPress: () => void }) {
  return (
    <Press onPress={onPress} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
      <Icon name="back" />
    </Press>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Label dim size={13} style={{ marginBottom: 8, marginLeft: 4 }}>
        {title}
      </Label>
      <Card style={{ padding: 0, overflow: "hidden" }}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, minHeight: 64 },
  answers: { flexDirection: "row", gap: 6, marginTop: 10 },
  answer: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: 14 },
  answerMain: { backgroundColor: color.bone, paddingHorizontal: 18 },
  scores: { flexDirection: "row", gap: 14, marginTop: 12 },
  stepper: { flexDirection: "row", alignItems: "center", marginTop: 6, minHeight: 56, borderRadius: 16, backgroundColor: color.fill2, paddingHorizontal: 6 },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  minus: { width: 14, height: 2, borderRadius: 1, backgroundColor: color.bone },
  input: { minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
});
