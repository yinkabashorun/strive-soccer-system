import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MATCHUP_HOW_LINES, MATCHUP_HOW_TITLE, MATCHUP_TITLE } from "@shared/club-matchup-words";
import { Body, Button, Eyebrow, Head } from "@/ui";
import { color } from "@/theme";

// "How it works": the weekly club matchup, explained once, in a sheet over
// the club's page. Every line is lib/elite/club-matchup-words.ts's, the
// file the website's sheet reads too, written so a 9 year old understands
// it the first time: short sentences, common words, one idea each.
export default function HowMatchupsWork() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.black }}
      contentContainerStyle={{ paddingTop: 28, paddingHorizontal: 24, paddingBottom: insets.bottom + 28 }}
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
    >
      <Eyebrow>{MATCHUP_TITLE}</Eyebrow>
      <Head size={38} style={{ marginTop: 10 }}>
        {MATCHUP_HOW_TITLE}
      </Head>
      <View style={{ marginTop: 18, gap: 16 }}>
        {MATCHUP_HOW_LINES.map((line) => (
          <Body key={line} size={17}>
            {line}
          </Body>
        ))}
      </View>
      <Button style={{ marginTop: 30 }} label="Got it" onPress={() => router.back()} />
    </ScrollView>
  );
}
