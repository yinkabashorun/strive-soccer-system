import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  INVITE_DONE,
  INVITE_EYEBROW,
  INVITE_NOT_NOW,
  INVITE_NOT_ONE,
  INVITE_SENT_EYEBROW,
  inviteClubButton,
  inviteFriendButton,
  inviteFriendTitle,
  inviteFromParams,
  type AskedInvite,
} from "@shared/friend-link";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { refreshClubs } from "@/api/clubs";
import { refreshFree, sendInvite, useInvite } from "@/api/free";
import { useMe } from "@/api/queries";
import { Avatar } from "@/Avatar";
import { Crest } from "@/Crest";
import { homeOf } from "@/navigation";
import { useBelowClock } from "@/Screen";
import { Body, Button, Eyebrow, Head, Icon, Press, Skeleton } from "@/ui";
import { color } from "@/theme";

// AN INVITE LINK, opened in the app (lib/elite/friend-link.ts): a teammate's
// link from a text, or their QR code read by this phone's camera
// (app/friend/code.tsx on their phone). The app kept the code and put this
// screen on top of wherever the player was (src/InviteOpener.tsx).
//
// It says who the invite is from, as far as the website tells a visitor: a
// teammate's first name and initials (never a photo: the two are not
// friends yet), or a club's name. Then ONE button: "Send Kai a friend
// request" or "Ask to join Renegados FC". The other way out is "Not now".
//
// NOTHING IS SENT BY OPENING THIS SCREEN. Reading who the invite is from is
// a read; the request is made by the tap on the button, through the door's
// own route (the website's own two asks, with their caps, blocks and
// refusals). tests/add-friend.test.ts holds that no effect here sends it.
export default function InviteLink() {
  const asked = inviteFromParams(useLocalSearchParams<{ code?: string; kind?: string }>());
  // a second invite opened while the first is still on screen is a new
  // screen: what was sent for one is never shown for the other
  return <InviteAsk key={asked ? `${asked.code}:${asked.kind}` : "none"} asked={asked} />;
}

function InviteAsk({ asked }: { asked: AskedInvite | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const me = useMe();
  const q = useInvite(asked);
  const invite = q.data?.ok ? q.data : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // opened from a link there may be nothing under this screen to go back to
  const close = () => (router.canGoBack() ? router.back() : router.replace(homeOf(me.data?.state) as Href));

  async function send() {
    if (!asked || !invite) return;
    setError(null);
    setBusy(true);
    try {
      const res = await sendInvite({ code: invite.code, kind: invite.kind });
      if (!res.ok) return setError(res.error);
      void refreshFree();
      if (res.kind === "club") void refreshClubs();
      setSent(res.line);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  // what the server said when the link is not an invite it knows
  const refused = !asked
    ? INVITE_NOT_ONE
    : q.data && !q.data.ok
      ? q.data.error
      : q.error instanceof ApiError && q.error.status === 400
        ? q.error.message
        : null;

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: color.black }, belowClock]}
      contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <Press onPress={close} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Close">
        <Icon name="close" />
      </Press>

      {sent ? (
        <>
          <Eyebrow style={{ marginTop: 14 }}>{INVITE_SENT_EYEBROW}</Eyebrow>
          <Head size={32} style={{ marginTop: 10 }}>
            {sent}
          </Head>
          <Button style={{ marginTop: 24 }} label={INVITE_DONE} onPress={close} />
        </>
      ) : refused ? (
        <>
          <Head size={32} style={{ marginTop: 14 }}>
            {refused}
          </Head>
          <Button style={{ marginTop: 24 }} label={INVITE_DONE} onPress={close} />
        </>
      ) : !invite ? (
        q.isError || q.isPaused ? (
          <View style={{ marginTop: 20 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={q.isFetching} onPress={() => void q.refetch()} />
          </View>
        ) : (
          <View style={{ marginTop: 20, gap: 14 }}>
            <Skeleton height={88} width={88} r={44} />
            <Skeleton height={120} />
          </View>
        )
      ) : (
        <>
          <View style={styles.who}>
            {invite.kind === "club" ? <Crest club={{ id: invite.id, name: invite.name }} size={88} /> : <Avatar initials={invite.initials} size={88} />}
          </View>
          <Eyebrow style={{ marginTop: 18 }}>{INVITE_EYEBROW}</Eyebrow>
          <Head size={36} style={{ marginTop: 8 }}>
            {invite.kind === "club" ? invite.name : inviteFriendTitle(invite.first)}
          </Head>
          <Body dim style={{ marginTop: 12 }}>
            {invite.body}
          </Body>
          {error ? (
            <View accessibilityLiveRegion="polite">
              <Body size={13.5} style={{ color: color.danger, marginTop: 16 }}>
                {error}
              </Body>
            </View>
          ) : null}
          <Button
            style={{ marginTop: 24 }}
            label={invite.kind === "club" ? inviteClubButton(invite.name) : inviteFriendButton(invite.first)}
            busy={busy}
            onPress={() => void send()}
          />
          <Button quiet style={{ marginTop: 10 }} label={INVITE_NOT_NOW} onPress={close} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  who: { marginTop: 14, alignSelf: "flex-start" },
});
