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
import { Body, Button, Card, Hairline, Head, Label, Ring, SettingRow, Skeleton } from "@/ui";

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

      <View style={styles.who}>
        <Ring size={116} stroke={5} value={y?.aura.progress ?? 0}>
          <MyAvatar initials={initialsOf(name)} size={98} />
        </Ring>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessible accessibilityLabel={y?.starred ? `${name}. ${STAR_LABEL}` : name}>
            <Head size={26} numberOfLines={1}>
              {name}
            </Head>
            {y?.starred ? <Star size={16} /> : null}
          </View>
          {username ? (
            <Body dim size={14} style={{ marginTop: 2 }}>
              @{username}
            </Body>
          ) : null}
          {y ? (
            <Label size={14} style={{ marginTop: 10 }}>
              {y.aura.label}
            </Label>
          ) : null}
          {y?.aura.next ? (
            <Body dim size={12.5} style={{ marginTop: 2 }}>
              {y.aura.next}
            </Body>
          ) : null}
        </View>
      </View>

      {!y ? (
        you.isError || you.isPaused ? (
          <View style={{ margin: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={you.isFetching} onPress={() => void you.refetch()} />
          </View>
        ) : (
          <Skeleton height={110} style={{ margin: 20 }} />
        )
      ) : (
        <View style={styles.numbers}>
          <Card style={styles.number}>
            <Head size={34}>{fmtDuration(y.weekMinutes)}</Head>
            <Body dim size={13}>
              this week
            </Body>
          </Card>
          <Card style={styles.number}>
            <Head size={34}>{fmtDuration(y.allMinutes)}</Head>
            <Body dim size={13}>
              all time. It only ever goes up.
            </Body>
          </Card>
        </View>
      )}
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
  who: { flexDirection: "row", alignItems: "center", gap: 18, marginHorizontal: 20, marginTop: 20 },
  numbers: { flexDirection: "row", gap: 12, marginHorizontal: 20, marginTop: 22 },
  number: { flex: 1, padding: 16 },
});
