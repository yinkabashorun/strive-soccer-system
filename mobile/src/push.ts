import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { APP_API } from "@shared/app-contract";
import { api } from "@/api/client";
import { setPref } from "./prefs";

// Notifications, the Apple way: the site sends straight to Apple's push
// service with this phone's device token (lib/elite/apns.ts, migration 067),
// so the app hands the server its raw APNs token, never a relay's.
//
// Asked once, on the first finish screen (punch list A8), never at launch.
// While the app is open a notification is quiet: it goes to the list, no
// banner over the screen being used (research B, Nov 18).
//
// NO NUMBER ON THE ICON, ever (Nov 24 2026): the site sends no badge count
// (lib/elite/apns.ts), this handler sets none, and whatever number an
// earlier build left there is cleared each time the app comes to the
// front (clearBadge, called from app/_layout.tsx). A red number is a debt
// the player did not ask for; what is new is the Inbox's quiet gold dot.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function clearBadge(): void {
  if (Platform.OS !== "ios") return;
  void Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

async function saveToken(): Promise<boolean> {
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data !== "string") return false;
  await api(APP_API.pushToken, { method: "POST", body: { token: token.data } });
  return true;
}

export async function turnOnNotifications(): Promise<boolean> {
  await setPref("pushAsked", true);
  if (Platform.OS !== "ios" || !Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  if (!status.granted) {
    await setPref("pushOn", false);
    return false;
  }
  const ok = await saveToken().catch(() => false);
  await setPref("pushOn", ok);
  return ok;
}

// Turned off in Settings: this phone comes off the account. The phone's own
// permission stays as the person set it in iOS Settings.
export async function turnOffNotifications(): Promise<void> {
  await setPref("pushOn", false);
  if (Platform.OS !== "ios" || !Device.isDevice) return;
  const token = await Notifications.getDevicePushTokenAsync().catch(() => null);
  if (token && typeof token.data === "string") {
    await api(APP_API.pushToken, { method: "DELETE", body: { token: token.data } }).catch(() => undefined);
  }
}

// A phone that already said yes stays on file: the token can change (a
// restore, a reinstall), so it is saved again quietly on each open.
export async function keepTokenFresh(): Promise<void> {
  if (Platform.OS !== "ios" || !Device.isDevice) return;
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (p?.granted) await saveToken().catch(() => undefined);
}
