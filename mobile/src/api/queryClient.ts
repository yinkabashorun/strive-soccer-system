import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

// Every screen opens on the last thing it showed (the cache is kept on the
// phone) and refreshes behind it. Opening the app again counts as a focus,
// so a week that changed while the app was away is fetched on return
// (punch list A5).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000,
      retry: (count, error) => {
        const status = (error as { status?: number })?.status ?? 0;
        return status !== 401 && status !== 403 && count < 2;
      },
      networkMode: "offlineFirst",
    },
    mutations: { networkMode: "offlineFirst", retry: 0 },
  },
});

export const CACHE_KEY = "strive.cache.v1";

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  throttleTime: 800,
});

// A week of cached screens at most; a new app version starts clean.
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (s) => focusManager.setFocused(s === "active"));
}

// Signing out leaves nothing of the account on the phone.
export async function clearCache(): Promise<void> {
  queryClient.clear();
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => undefined);
}
