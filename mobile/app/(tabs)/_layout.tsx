import { NativeTabs } from "expo-router/native-tabs";
import { useMe } from "@/api/queries";
import { color } from "@/theme";
import { PHASE_ONE_TABS } from "@/tabs";

// The real iPhone tab bar (UITabBarController): Home, Week and You in phase
// 1, from the one rule the website uses (memberTabs, sent by the server).
// Courses and the Elite Coach tab are phase 2; their routes slot in here
// and show the moment the server lists them and the screens exist.
export default function TabsLayout() {
  const me = useMe();
  const listed = new Set((me.data?.tabs ?? []).map((t) => t.key));
  const show = (key: string) => listed.size === 0 || listed.has(key);
  return (
    <NativeTabs tintColor={color.bone} iconColor={{ default: color.faint, selected: color.bone }} backgroundColor={color.black}>
      {PHASE_ONE_TABS.map((t) => (
        <NativeTabs.Trigger key={t.route} name={t.route} hidden={!show(t.key)}>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf, selected: t.sfSelected }} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
