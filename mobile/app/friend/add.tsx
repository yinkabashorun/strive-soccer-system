import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ADD_ANOTHER,
  ADD_BODY,
  ADD_DONE,
  ADD_EMPTY,
  ADD_FIELD,
  ADD_FRIENDS_EYEBROW,
  ADD_MY_CODE,
  ADD_MY_CODE_DETAIL,
  ADD_NOT_FOUND,
  ADD_PLACEHOLDER,
  ADD_SEND,
  ADD_SENT_EYEBROW,
  ADD_TITLE,
  usernameToFind,
} from "@shared/friend-add";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { askFriend, refreshFree } from "@/api/free";
import { FormScreen } from "@/FormScreen";
import { LabeledField } from "@/LabeledField";
import { Body, Button, Card, Eyebrow, Head, Icon, Press, SettingRow } from "@/ui";
import { color, font } from "@/theme";

// ADD A FRIEND, standing next to them (lib/elite/friend-add.ts): type their
// @username EXACTLY and they get a friend request to accept. Or show them
// your own code to scan (app/friend/code.tsx).
//
// This is not a search. One username is sent, and one plain line comes
// back: the request went, or it did not. Nobody is listed, nothing is
// suggested as the name is typed, and a username nobody has reads the same
// as a player who does not want to be added.
//
// The button that sends is never switched off: a tap with an empty box
// says what to type. It is the page's footer, so it rides on the keyboard
// (FormScreen).
export default function AddFriend() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ line: string; friends: boolean } | null>(null);

  async function send() {
    if (!name.trim()) return setError(ADD_EMPTY);
    // not shaped like a username at all: nobody has it, and nothing is asked
    if (!usernameToFind(name)) return setError(ADD_NOT_FOUND);
    setError(null);
    setBusy(true);
    try {
      const res = await askFriend(name);
      if (!res.ok) return setError(res.error);
      void refreshFree();
      setDone({ line: res.line, friends: res.result === "friends" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : OFFLINE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
      <Icon name="back" />
    </Press>
  );
  const pad = { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 24 };
  const foot = { paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16 };

  if (done) {
    return (
      <FormScreen
        safeTop
        contentStyle={pad}
        footer={
          <View style={foot}>
            <Button label={ADD_DONE} onPress={() => router.back()} />
            <Button
              quiet
              style={{ marginTop: 10 }}
              label={ADD_ANOTHER}
              onPress={() => {
                setName("");
                setDone(null);
              }}
            />
          </View>
        }
      >
        {back}
        <Eyebrow style={{ marginTop: 14 }}>{done.friends ? ADD_FRIENDS_EYEBROW : ADD_SENT_EYEBROW}</Eyebrow>
        <Head size={32} style={{ marginTop: 10 }}>
          {done.line}
        </Head>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      safeTop
      contentStyle={pad}
      footer={
        <View style={foot}>
          {error ? (
            <View accessibilityLiveRegion="polite">
              <Body size={13.5} style={{ color: color.danger, marginBottom: 12 }}>
                {error}
              </Body>
            </View>
          ) : null}
          <Button label={ADD_SEND} busy={busy} onPress={() => void send()} />
        </View>
      }
    >
      {back}
      <Head size={40} style={{ marginTop: 8 }}>
        {ADD_TITLE}
      </Head>
      <Body dim style={{ marginTop: 10 }}>
        {ADD_BODY}
      </Body>
      <LabeledField
        label={ADD_FIELD}
        style={{ marginTop: 22 }}
        inputStyle={styles.input}
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError(null);
        }}
        placeholder={ADD_PLACEHOLDER}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />
      <Card style={{ marginTop: 26, padding: 0 }}>
        <SettingRow label={ADD_MY_CODE} detail={ADD_MY_CODE_DETAIL} onPress={() => router.push("/friend/code")} />
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 60, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.label, fontSize: 20 },
});
