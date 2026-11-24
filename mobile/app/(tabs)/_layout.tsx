import { NativeTabs } from "expo-router/native-tabs";
import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/session";
import { Holding } from "@/Holding";
import { areaFor } from "@/navigation";
import { color } from "@/theme";
import { APP_TABS } from "@/tabs";

// The real iPhone tab bar (UITabBarController): Home, Week, Courses and
// You, from the one rule the website uses (memberTabs, sent by the server).
// A tab shows when the server lists it for this member. The Elite Coach
// tab slots in here the moment its screen exists.
//
// disableAutomaticContentInsets: each tab's page (src/Screen.tsx) leaves its
// own room for the status bar and the tab bar. Left on, the tab bar adds the
// same room a second time and the page starts a status bar lower (seen in
// the first simulator run, Nov 23 2026).
//
// This is also the first screen the app opens on, before it is known where
// the person belongs. The tabs are drawn only for someone who belongs in
// the app; anyone else gets the holding screen (src/Holding.tsx) for the
// moment it takes the root layout to send them on.
export default function TabsLayout() {
  const { ready, signedIn } = useAuth();
  const me = useMe();
  const area = ready ? areaFor(signedIn, me.data?.state, me.data?.profileSetup) : null;
  if (area !== "app") {
    const failed = ready && signedIn && !me.data && (me.isError || me.isPaused);
    return <Holding failed={failed} busy={me.isFetching} retry={() => void me.refetch()} />;
  }
  const listed = new Set((me.data?.tabs ?? []).map((t) => t.key));
  const show = (key: string) => listed.size === 0 || listed.has(key);
  return (
    <NativeTabs tintColor={color.bone} iconColor={{ default: color.faint, selected: color.bone }} backgroundColor={color.black}>
      {APP_TABS.map((t) => (
        <NativeTabs.Trigger key={t.route} name={t.route} hidden={!show(t.key)} disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf, selected: t.sfSelected }} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
