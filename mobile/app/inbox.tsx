import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppNotice } from "@shared/app-contract";
import { agoLabel } from "@shared/notices";
import { NATIVE_INBOX, inboxWebRow, nativeRouteFor } from "@shared/notice-routes";
import { keys, markInboxRead, useInbox } from "@/api/queries";
import { queryClient } from "@/api/queryClient";
import { openSite } from "@/links";
import { Body, Card, Hairline, Head, Icon, Label, Press, Skeleton } from "@/ui";
import { color } from "@/theme";

// The Inbox: every note the member has been sent, each once, newest first
// (the same notes as the website's bell, lib/elite/bell.ts). Opened from
// the small bell on Home, and by a tapped notification from the coach.
//
// Opening it is reading it: every note is marked read and Home's gold dot
// goes. The notes that were new keep their own gold dot until the Inbox is
// left, so the member can see which they had not read. Never a count.
//
// A note opens the screen it is about (one map, lib/elite/notice-routes.ts).
// A note from the coach is read right here; the app has no Coach screens
// yet, so under it one plain row opens that page of the website in the
// sheet over the app.
export default function Inbox() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inbox = useInbox();
  const [pulling, setPulling] = useState(false);
  // which notes were new when the Inbox was opened
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || !inbox.data) return;
    marked.current = true;
    const ids = inbox.data.filter((n) => n.fresh).map((n) => n.id);
    setFresh(new Set(ids));
    if (ids.length > 0) void markInboxRead();
  }, [inbox.data]);

  const notes = inbox.data;
  const now = Date.now();

  return (
    <View style={{ flex: 1, backgroundColor: color.black, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            tintColor={color.bone}
            refreshing={pulling}
            onRefresh={async () => {
              setPulling(true);
              await queryClient.invalidateQueries({ queryKey: keys.inbox }).catch(() => undefined);
              setPulling(false);
            }}
          />
        }
      >
        <Press onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
          <Icon name="back" />
        </Press>
        <Head size={40} style={{ marginTop: 8 }}>
          Inbox
        </Head>

        {!notes ? (
          inbox.isError ? (
            <Body dim style={{ marginTop: 22 }}>
              We could not reach Strive. Check your connection and pull down to try again.
            </Body>
          ) : (
            <View style={{ marginTop: 22, gap: 10 }}>
              <Skeleton height={84} r={22} />
              <Skeleton height={84} r={22} />
              <Skeleton height={84} r={22} />
            </View>
          )
        ) : notes.length === 0 ? (
          <Body dim style={{ marginTop: 22 }}>
            Nothing here yet. Each new week and every medal you earn shows up here.
          </Body>
        ) : (
          <View style={{ marginTop: 22, gap: 10 }}>
            {notes.map((n) => (
              <Note key={n.id} note={n} fresh={fresh.has(n.id)} now={now} onOpen={(route) => router.navigate(route as Href)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Note({ note, fresh, now, onOpen }: { note: AppNotice; fresh: boolean; now: number; onOpen: (route: string) => void }) {
  // Where the note opens in this app. A note that opens the Inbox itself
  // (anything from the coach) or that says nowhere (from before the
  // address was kept) is read here and is not a button.
  const route = note.path ? nativeRouteFor(note.path, "member", note.topic) : null;
  const opens = route !== null && route !== NATIVE_INBOX;
  const web = inboxWebRow(note);

  const words = (
    <View style={styles.row}>
      <View style={[styles.dot, fresh ? { backgroundColor: color.gold } : null]} />
      <View style={{ flex: 1 }}>
        <Label size={15.5}>{note.title}</Label>
        {note.body ? (
          <Body dim size={14} style={{ marginTop: 3, lineHeight: 20 }} selectable={!opens}>
            {note.body}
          </Body>
        ) : null}
        <Body size={12} style={{ marginTop: 6, color: color.faint }}>
          {agoLabel(note.at, now)}
        </Body>
      </View>
      {opens ? <Icon name="chevron" size={18} stroke={color.faint} /> : null}
    </View>
  );

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {opens ? (
        <Press onPress={() => onOpen(route)} accessibilityLabel={`${fresh ? "New. " : ""}${note.title}. ${note.body}`}>
          {words}
        </Press>
      ) : (
        <View accessible accessibilityLabel={`${fresh ? "New. " : ""}${note.title}. ${note.body}`}>
          {words}
        </View>
      )}
      {web ? (
        <>
          <Hairline />
          <Press onPress={() => void openSite(web.path)} style={styles.web} accessibilityLabel={web.label}>
            <Label size={14} style={{ flex: 1 }}>
              {web.label}
            </Label>
            <Icon name="chevron" size={18} stroke={color.faint} />
          </Press>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: "transparent" },
  web: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: 16, paddingLeft: 36 },
});
