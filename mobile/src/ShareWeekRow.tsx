import { useState } from "react";
import { ActivityIndicator, Share, View } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import { ApiError, OFFLINE_MESSAGE } from "@/api/client";
import { getWeekCard } from "@/api/free";
import { FIXTURES } from "@/config";
import { SHARE_WEEK_FAILED, SHARE_WEEK_ROW, cardPicture, isCardFile, shareWeekContent } from "@/share-week";
import { Body, Card, Icon, Label, Press, styles as ui } from "@/ui";
import { color } from "@/theme";

// Share my week: one quiet row under the friends board. A tap asks the
// server for the player's own week as a story-size picture
// (lib/elite/week-card-image.ts draws it), writes it to a file on this
// phone, and opens the phone's own share sheet with it. The player picks
// where it goes; nothing is ever posted for them.
//
// How the picture becomes a file, with only what the app already has
// installed (read in each package's own source, Nov 25 2026):
//   - the server answers JSON with the PNG as a base64 data URI, through
//     the one API client (src/api/client.ts)
//   - expo-image-manipulator reads a base64 data URI as its source and
//     saves a PNG into the app's cache, giving back its file address
//     (ios/ImageManipulatorUtils.swift: loadImage for the "data" scheme,
//     saveImage into <caches>/ImageManipulator/<id>.png)
//   - React Native's Share hands a file address to the share sheet as the
//     file itself (React/CoreModules/RCTActionSheetManager.mm)
// If the picture cannot be written, the words and the player's link are
// shared on their own.
async function cardFile(image: unknown): Promise<string | null> {
  const picture = cardPicture(image);
  // the example build is sent no picture, and makes no file
  if (FIXTURES || !picture) return null;
  try {
    const out = await ImageManipulator.manipulateAsync(picture, [], { format: ImageManipulator.SaveFormat.PNG });
    return isCardFile(out.uri) ? out.uri : null;
  } catch {
    return null;
  }
}

export function ShareWeekRow() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const card = await getWeekCard();
      const file = await cardFile(card.image);
      // closing the sheet without sharing is an answer, not a failure, and
      // neither is a sheet that would not open: the card itself was made
      await Share.share(shareWeekContent({ text: card.text, file })).catch(() => undefined);
    } catch (e) {
      setNote(e instanceof ApiError && e.code === "offline" ? OFFLINE_MESSAGE : SHARE_WEEK_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginHorizontal: 20, marginTop: 16 }}>
      <Card style={{ padding: 0 }}>
        <Press
          onPress={() => void share()}
          disabled={busy}
          accessibilityLabel={SHARE_WEEK_ROW.title}
          accessibilityHint={SHARE_WEEK_ROW.detail}
          accessibilityState={{ disabled: busy, busy }}
        >
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Label>{SHARE_WEEK_ROW.title}</Label>
              <Body dim size={13} style={{ marginTop: 2 }}>
                {SHARE_WEEK_ROW.detail}
              </Body>
            </View>
            {busy ? <ActivityIndicator color={color.bone} /> : <Icon name="chevron" size={18} stroke={color.faint} />}
          </View>
        </Press>
      </Card>
      {note ? (
        <Body dim size={13} style={{ marginTop: 8 }}>
          {note}
        </Body>
      ) : null}
    </View>
  );
}
