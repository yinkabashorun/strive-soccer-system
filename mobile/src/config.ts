import Constants from "expo-constants";

// Where the app talks to: the site's app API and Supabase (the publishable
// key is public, the same one every page of the website carries).
type Extra = { apiBase?: string; supabaseUrl?: string; supabaseKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const API_BASE = (extra.apiBase ?? "https://thestriveapp.com").replace(/\/+$/, "");
export const SUPABASE_URL = extra.supabaseUrl ?? "";
export const SUPABASE_KEY = extra.supabaseKey ?? "";

// The example data the screens are rendered with for review screenshots
// (the browser build and the simulator build on GitHub's Mac; see
// src/api/fixtures.ts). Set at bundle time; the TestFlight workflow never
// sets it (tests/app-shared.test.ts).
export const FIXTURES = process.env.EXPO_PUBLIC_FIXTURES === "1";
export const MEDIA_BASE = process.env.EXPO_PUBLIC_MEDIA_BASE ?? API_BASE;

// The Meta (Facebook) app ID that Instagram asks for before it takes a
// story from another app (docs/app-store/share-kits-research-2026-11-28.md,
// section 1). Public, like the keys above; set at bundle time. Not set
// (today): the training card shows no "Instagram story" button
// (lib/elite/session-card.ts cardButtons), and More still reaches Instagram
// through the phone's own share sheet.
export const META_APP_ID = (process.env.EXPO_PUBLIC_META_APP_ID ?? "").trim() || null;
