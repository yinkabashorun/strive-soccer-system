import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { color } from "./theme";

// A drill's demo: its still at once (punch list A6), the clip looping on
// mute over it the moment it can play. A phone that switched off "play
// drill demos on their own" sees the still until the clip is tapped.
export function DrillVideo({ src, poster, autoplay }: { src: string | null; poster: string | null; autoplay: boolean }) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(src ? { uri: src } : null, (p) => {
    p.loop = true;
    p.muted = true;
    if (autoplay) p.play();
  });
  const show = useSharedValue(0);

  useEffect(() => {
    setReady(false);
    show.value = 0;
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") setReady(true);
    });
    return () => sub.remove();
  }, [player, src, show]);

  useEffect(() => {
    show.value = withTiming(ready ? 1 : 0, { duration: 250 });
  }, [ready, show]);

  const fade = useAnimatedStyle(() => ({ opacity: show.value }));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: color.fill }]}>
      {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {src ? (
        <Animated.View style={[StyleSheet.absoluteFill, fade]} pointerEvents="none">
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        </Animated.View>
      ) : null}
    </View>
  );
}
