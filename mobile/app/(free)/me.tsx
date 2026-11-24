import { Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { fmtDuration } from "@shared/time-trained";
import { STAR_LABEL, initialsOf } from "@shared/tracker";
import { useMe, useYou } from "@/api/queries";
import { MemberCard } from "@/MemberCard";
import { hasTrain } from "@/navigation";
import { useMyPhoto } from "@/usePhoto";
import { YouEarned } from "@/YouEarned";
import { OFFLINE_MESSAGE } from "@/api/client";
import { refreshFree, useFreeYou } from "@/api/free";
import { MyAvatar, Star } from "@/Avatar";
import { PAGE_TOP, Screen } from "@/Screen";
import { Body, Button, Card, Eyebrow, Hairline, Head, Ring, SettingRow, Skeleton } from "@/ui";
import { color } from "@/theme";

// You, in the free app: your photo and @username, your aura level (earned
// by training and by nothing else; it only goes up), this week and all
// time, and Settings. Sign out and Delete my account are in Settings, as
// for everyone.
//
// Strive Pro adds to this screen and takes nothing off it: the member
// card, the earned month's line when there is one, time by area and the
// medals (src/YouEarned.tsx, the member app's own).
//
// There is no upgrade wording on this screen.
export default function Me() {
  const router = useRouter();
  const me = useMe();
  const you = useFreeYou();
  const y = you.data;
  const name = y?.name ?? me.data?.free?.name ?? "";
  const username = me.data?.profileSetup?.username;
  // Strive Pro is on (lib/elite/one-app.ts): the SAME You tab, with the
  // member card and what their sessions have earned added under it.
  const train = hasTrain(me.data?.state);
  const { data: member } = useYou();
  const photo = useMyPhoto();
  const card = member?.card ?? me.data?.player?.card;

  return (
    <Screen onRefresh={refreshFree}>
      <View style={{ paddingHorizontal: 20, paddingTop: PAGE_TOP }}>
        <Head size={40}>You</Head>
      </View>

      {/* One card, the way a member has their card: who you are, the level
          your training has earned (it only goes up), and your two numbers. */}
      <Card style={styles.card}>
        <View style={styles.who}>
          <Ring size={104} stroke={5} value={y?.aura.progress ?? 0}>
            <MyAvatar initials={initialsOf(name)} size={88} />
          </Ring>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessible accessibilityLabel={y?.starred ? `${name}. ${STAR_LABEL}` : name}>
              <Head size={28} numberOfLines={1}>
                {name}
              </Head>
              {y?.starred ? <Star size={16} /> : null}
            </View>
            {username ? (
              <Body dim size={14} style={{ marginTop: 2 }}>
                @{username}
              </Body>
            ) : null}
          </View>
        </View>

        {!y ? (
          you.isError || you.isPaused ? (
            <View style={{ marginTop: 18 }}>
              <Body dim>{OFFLINE_MESSAGE}</Body>
              <Button quiet style={{ marginTop: 16 }} label="Try again" busy={you.isFetching} onPress={() => void you.refetch()} />
            </View>
          ) : (
            <Skeleton height={110} style={{ marginTop: 18 }} />
          )
        ) : (
          <>
            <View style={styles.level} accessible accessibilityLabel={[y.aura.label, y.aura.next].filter(Boolean).join(". ")}>
              <Eyebrow>{y.aura.label}</Eyebrow>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, y.aura.progress)) * 100)}%` }]} />
              </View>
              {y.aura.next ? (
                <Body dim size={12.5} style={{ marginTop: 7 }}>
                  {y.aura.next}
                </Body>
              ) : null}
            </View>
            <View style={styles.numbers}>
              <View style={styles.number}>
                <Head size={36}>{fmtDuration(y.weekMinutes)}</Head>
                <Body dim size={13}>
                  this week
                </Body>
              </View>
              <View style={styles.divider} />
              <View style={styles.number}>
                <Head size={36}>{fmtDuration(y.allMinutes)}</Head>
                <Body dim size={13}>
                  all time. It only ever goes up.
                </Body>
              </View>
            </View>
          </>
        )}
      </Card>
      {y?.gymLine ? (
        <Body dim size={13.5} style={{ marginHorizontal: 20, marginTop: 10 }}>
          {y.gymLine}
        </Body>
      ) : null}

      {train ? (
        <View style={{ marginHorizontal: 20, marginTop: 22 }}>
          {card ? (
            <MemberCard name={card.name} since={card.since} tier={card.tier} photo={photo} username={username} />
          ) : (
            <Skeleton height={204} r={22} />
          )}
          {member?.earned ? (
            <Card style={{ marginTop: 16 }}>
              <Body size={14}>{member.earned.line}</Body>
              {member.earned.parent ? (
                <Button
                  quiet
                  style={{ marginTop: 12 }}
                  label={member.earned.parent.label}
                  onPress={() => void Share.share({ message: member.earned!.parent!.text }).catch(() => undefined)}
                />
              ) : null}
            </Card>
          ) : null}
        </View>
      ) : null}
      {train && member ? <YouEarned y={member} /> : null}

      <Card style={{ marginHorizontal: 20, marginTop: 26, padding: 0 }}>
        {y ? (
          <>
            <SettingRow
              label="Send my link to a teammate"
              detail="They join, you accept, and you see each other's training."
              onPress={() => void Share.share({ url: y.invite }).catch(() => undefined)}
            />
            <Hairline />
          </>
        ) : null}
        <SettingRow label="Settings" detail="Notifications, your photo, your password" onPress={() => router.push("/settings")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 18, padding: 20, overflow: "hidden", borderColor: "rgba(200,168,88,0.28)" },
  who: { flexDirection: "row", alignItems: "center", gap: 16 },
  level: { marginTop: 20 },
  track: { height: 6, borderRadius: 3, backgroundColor: color.fill2, marginTop: 9, overflow: "hidden" },
  // earned by training and by nothing else: gold
  fill: { height: 6, borderRadius: 3, backgroundColor: color.gold },
  numbers: { flexDirection: "row", alignItems: "stretch", marginTop: 20, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  number: { flex: 1 },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: color.line, marginHorizontal: 16 },
});
