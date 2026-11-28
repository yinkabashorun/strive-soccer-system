import { Modal, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CARD_WORDS } from "@shared/session-card";
import { Button, Head, Icon, Label, Press } from "@/ui";
import { color } from "@/theme";

// A training photo, full screen: opened by a tap on a photo in a profile's
// grid. The whole photo is shown (never cropped), it can be pinched larger
// (the phone's own zoom), and Close or the phone's back gesture puts it
// away. Nothing can be saved, shared or sent from here: a friend's photo
// stays inside the app. On your OWN photo one button, "Make my card", opens
// your training card from it (app/card.tsx), which is yours to share.
export type ViewedPhoto = { uri: string; said: string; time: string; kind: "training" | "gym" };

export function PhotoViewer({ photo, onClose, onMakeCard }: { photo: ViewedPhoto | null; onClose: () => void; onMakeCard?: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible={photo !== null} transparent={false} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.back}>
        {photo ? (
          <>
            <ScrollView
              style={StyleSheet.absoluteFill}
              contentContainerStyle={{ width, height }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: photo.uri }} style={{ width, height }} contentFit="contain" cachePolicy="disk" accessibilityLabel={photo.said} />
            </ScrollView>
            <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
              <Press onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close the photo">
                <Icon name="close" />
              </Press>
            </View>
            <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]} pointerEvents="box-none">
              <Label size={12} dim style={{ letterSpacing: 1.6, textTransform: "uppercase" }}>
                {photo.kind === "gym" ? "Gym" : "Training"}
              </Label>
              <Head size={30}>{photo.time}</Head>
              {onMakeCard ? <Button label={CARD_WORDS.make} style={{ marginTop: 16 }} onPress={onMakeCard} /> : null}
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

// The Close button keeps its own edge: a tall photo leaves black bars above
// and below it, and a dark circle with no edge is cut in half by the bar
// (the simulator's picture, Nov 25 2026).
const styles = StyleSheet.create({
  back: { flex: 1, backgroundColor: color.black },
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 14 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,20,20,0.72)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.28)" },
  bottom: { position: "absolute", left: 20, right: 20, bottom: 0 },
});
