import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PASSWORD_CHANGED_MESSAGE, passwordChangeProblem } from "@shared/account";
import { useChangePassword } from "@/api/queries";
import { ApiError } from "@/api/client";
import { FormScreen } from "@/FormScreen";
import { Body, Button, Head, Icon, Press } from "@/ui";
import { color, font } from "@/theme";

// Change password (punch list A9): the current one first, then the new
// one; the website's own rules and action. The phone stays signed in.
export default function ChangePassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go() {
    const problem = passwordChangeProblem({ current, next });
    if (problem) return setMsg({ ok: false, text: problem });
    try {
      await change.mutateAsync({ current, next });
      setMsg({ ok: true, text: PASSWORD_CHANGED_MESSAGE });
      setCurrent("");
      setNext("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "That didn't work. Try again." });
    }
  }

  return (
    <FormScreen safeTop contentStyle={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        <Press onPress={() => router.back()} style={{ width: 44, height: 44, justifyContent: "center" }} accessibilityLabel="Back">
          <Icon name="back" />
        </Press>
        <Head size={36} style={{ marginTop: 8 }}>
          Change password
        </Head>
        <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={color.faint} secureTextEntry textContentType="password" value={current} onChangeText={setCurrent} accessibilityLabel="Current password" />
        <TextInput style={styles.input} placeholder="New password, 8 characters or more" placeholderTextColor={color.faint} secureTextEntry textContentType="newPassword" value={next} onChangeText={setNext} accessibilityLabel="New password" />
        {msg ? <Body style={{ marginTop: 14, color: msg.ok ? color.bone : color.danger }}>{msg.text}</Body> : null}
        <Button style={{ marginTop: 20 }} label="Change password" busy={change.isPending} onPress={go} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: { marginTop: 14, minHeight: 56, borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, color: color.bone, fontFamily: font.body, fontSize: 16 },
});
