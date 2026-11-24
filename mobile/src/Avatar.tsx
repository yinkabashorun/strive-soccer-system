import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { useMyPhoto } from "./usePhoto";
import { Label } from "./ui";
import { color } from "./theme";

// A person in the free app: their profile photo, or their initials only
// when there is no photo to show. `uri` is the signed address the server
// sends for a friend (and for the player in a feed or on a board).
export function Avatar({
  uri,
  initials,
  size,
  lit = true,
  ring = false,
}: {
  uri?: string | null;
  initials: string;
  size: number;
  // dim when this person has not trained today (the row of faces)
  lit?: boolean;
  // a bone outline (a locked post's face)
  ring?: boolean;
}) {
  return (
    <View
      style={[
        styles.face,
        { width: size, height: size, borderRadius: size / 2, opacity: lit ? 1 : 0.42 },
        ring ? { borderWidth: 2, borderColor: color.bone } : null,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="disk" />
      ) : (
        <Label size={Math.max(11, Math.round(size * 0.34))}>{initials}</Label>
      )}
    </View>
  );
}

// The signed-in player's own face: their photo from our own address, kept
// by the phone while it is the same photo (src/usePhoto.ts), with the
// server's signed address as the fallback for the moment before it is read.
export function MyAvatar({ uri, initials, size, ring }: { uri?: string | null; initials: string; size: number; ring?: boolean }) {
  const mine = useMyPhoto();
  return (
    <View style={[styles.face, { width: size, height: size, borderRadius: size / 2 }, ring ? { borderWidth: 2, borderColor: color.bone } : null]}>
      {mine ? (
        <Image source={mine} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
      ) : uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
      ) : (
        <Label size={Math.max(11, Math.round(size * 0.34))}>{initials}</Label>
      )}
    </View>
  );
}

// The coaches' star beside a name (given and taken away only by a coach):
// drawn, in the gold of things that were earned.
export function Star({ size = 13 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill={color.gold} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  face: { backgroundColor: color.fill2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
