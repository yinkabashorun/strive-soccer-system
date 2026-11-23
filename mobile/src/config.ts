import Constants from "expo-constants";

// Where the app talks to: the site's app API and Supabase (the publishable
// key is public, the same one every page of the website carries).
type Extra = { apiBase?: string; supabaseUrl?: string; supabaseKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const API_BASE = (extra.apiBase ?? "https://thestriveapp.com").replace(/\/+$/, "");
export const SUPABASE_URL = extra.supabaseUrl ?? "";
export const SUPABASE_KEY = extra.supabaseKey ?? "";

// The example data the screens are rendered with for review screenshots
// (scripts/screenshots.mjs, web only). Set at bundle time; the iPhone
// workflow never sets it (tests/fixtures-off.test.ts).
export const FIXTURES = process.env.EXPO_PUBLIC_FIXTURES === "1";
export const MEDIA_BASE = process.env.EXPO_PUBLIC_MEDIA_BASE ?? API_BASE;
