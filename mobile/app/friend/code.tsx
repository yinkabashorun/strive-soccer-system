import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doorCodeFrom } from "@shared/free-door";
import { MY_CODE_BODY, MY_CODE_SAID, MY_CODE_SEND, MY_CODE_TITLE, myCodeLine } from "@shared/friend-add";
import { OFFLINE_MESSAGE } from "@/api/client";
import { useFreeYou } from "@/api/free";
import { useMe } from "@/api/queries";
import { QrCode } from "@/QrCode";
import { useBelowClock } from "@/Screen";
import { inviteShare } from "@/social-view";
import { Body, Button, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color } from "@/theme";

// MY CODE: the player's own invite as a QR code, for a teammate standing
// next to them. What the code holds is their own invite LINK, the same one
// "Send my link" shares (thestriveapp.com/join?ref=CODE): the teammate's
// iPhone camera reads it and opens the app on the one screen that asks
// first (app/friend/link.tsx), or the website when they do not have the
// app yet. The app has no scanner of its own and needs none.
//
// Scanning it makes nobody a friend: the teammate sends a request, and this
// player accepts it on Friends, as with every invite.
//
// Under it: who the code is for, and the same code in letters, to read out.
export default function MyCode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const belowClock = useBelowClock();
  const { width } = useWindowDimensions();
  const me = useMe();
  const you = useFreeYou();
  const y = you.data;
  const name = y?.name ?? me.data?.free?.name ?? "";
  const username = me.data?.profileSetup?.username;
  const code = y ? (doorCodeFrom(y.invite)?.code ?? null) : null;
  const side = Math.min(300, Math.max(200, width - 96));

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: color.black }, belowClock]}
      contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
        <Icon name="back" />
      </Press>
      <Head size={40} style={{ marginTop: 8 }}>
        {MY_CODE_TITLE}
      </Head>
      <Body dim style={{ marginTop: 10 }}>
        {MY_CODE_BODY}
      </Body>

      {!y ? (
        you.isError || you.isPaused ? (
          <View style={{ marginTop: 24 }}>
            <Body dim>{OFFLINE_MESSAGE}</Body>
            <Button quiet style={{ marginTop: 16 }} label="Try again" busy={you.isFetching} onPress={() => void you.refetch()} />
          </View>
        ) : (
          <Skeleton height={side} width={side} r={24} style={{ marginTop: 28, alignSelf: "center" }} />
        )
      ) : (
        <>
          <View style={styles.code}>
            <QrCode text={y.invite} size={side} said={MY_CODE_SAID} />
          </View>
          <Head size={28} style={{ marginTop: 22, textAlign: "center" }} numberOfLines={1}>
            {name}
          </Head>
          {username ? (
            <Body dim size={15} style={{ marginTop: 4, textAlign: "center" }}>
              @{username}
            </Body>
          ) : null}
          {code ? (
            <Label size={15} style={styles.letters}>
              {myCodeLine(code)}
            </Label>
          ) : null}
          <Button style={{ marginTop: 26 }} label={MY_CODE_SEND} onPress={() => void Share.share(inviteShare(y)).catch(() => undefined)} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  code: { marginTop: 28, alignItems: "center" },
  letters: { marginTop: 14, textAlign: "center", letterSpacing: 1.5 },
});
