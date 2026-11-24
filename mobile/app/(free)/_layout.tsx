import { NativeTabs } from "expo-router/native-tabs";
import { useMe } from "@/api/queries";
import { useAuth } from "@/auth/session";
import { Holding } from "@/Holding";
import { areaFor } from "@/navigation";
import { color } from "@/theme";
import { FREE_TABS } from "@/tabs";

// The free app's tab bar: Friends, Week, Courses and You, the same real
// iPhone tab bar the members' app uses (app/(tabs)/_layout.tsx), with the
// same two rules:
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
  return (
    <NativeTabs tintColor={color.bone} iconColor={{ default: color.faint, selected: color.bone }} backgroundColor={color.black}>
      {FREE_TABS.map((t) => (
        <NativeTabs.Trigger key={t.route} name={t.route} disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon sf={{ default: t.sf, selected: t.sfSelected }} />
          <NativeTabs.Trigger.Label>{t.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
