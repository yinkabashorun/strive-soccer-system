import { NativeTabs } from "expo-router/native-tabs";
import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/session";
import { Holding } from "@/Holding";
import { areaFor, hasTrain } from "@/navigation";
import { color } from "@/theme";
import { ONE_APP_SCREENS, oneAppTabBar } from "@/tabs";

// The one app's tab bar (lib/elite/one-app.ts): Friends, Week, Clubs and
// You for a free player, and the same four with Train in front once Strive
// Pro is on. Pro adds a tab; it never takes one away or swaps the bar for
// another. The same real iPhone tab bar the members' app uses
// (app/(tabs)/_layout.tsx), with the same two rules:
//
// disableAutomaticContentInsets: each tab's page (src/Screen.tsx) leaves its
// own room for the status bar and the tab bar.
//
// The tabs are drawn only for an account that belongs in the free app;
// anyone else gets the holding screen for the moment it takes the root
// layout to send them on.
export default function FreeLayout() {
  const { ready, signedIn } = useAuth();
  const me = useMe();
  const area = ready ? areaFor(signedIn, me.data?.state, me.data?.profileSetup) : null;
  if (area !== "free") {
    const failed = ready && signedIn && !me.data && (me.isError || me.isPaused);
    return <Holding failed={failed} busy={me.isFetching} retry={() => void me.refetch()} />;
  }
  const train = hasTrain(me.data?.state);
  const bar = oneAppTabBar(train);
  // Every screen of the group has its trigger, so the bar is told about
  // each one; a tab this person does not have is hidden, never left out.
  // The bar is built again when Train arrives or goes (the key), so the
  // phone never has to add a tab to a bar that is already on screen.
  const hidden = (Object.keys(ONE_APP_SCREENS) as (keyof typeof ONE_APP_SCREENS)[]).filter((k) => !bar.some((t) => t.key === k));
  return (
    <NativeTabs key={train ? "pro" : "free"} tintColor={color.bone} iconColor={{ default: color.faint, selected: color.bone }} backgroundColor={color.black}>
      {bar.map((t) => (
        <NativeTabs.Trigger key={t.route} name={t.route} disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf as never, selected: t.sfSelected as never }} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
      {hidden.map((k) => (
        <NativeTabs.Trigger key={ONE_APP_SCREENS[k].route} name={ONE_APP_SCREENS[k].route} hidden disableAutomaticContentInsets />
      ))}
    </NativeTabs>
  );
}
