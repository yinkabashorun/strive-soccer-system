import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "@/config";
import { chunkedStorage, type KV } from "./chunks";

// The phone signs in with Supabase directly (email and password), the same
// accounts as the website. The session is kept in the Keychain on iPhone,
// readable only after the phone has been unlocked once since it started.
const keychain: KV = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  remove: (k) => SecureStore.deleteItemAsync(k),
};
// The browser build (review screenshots only) has no Keychain.
const browser: KV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};

export const supabase = createClient(SUPABASE_URL || "https://invalid.local", SUPABASE_KEY || "missing", {
  auth: {
    storage: chunkedStorage(Platform.OS === "web" ? browser : keychain),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
