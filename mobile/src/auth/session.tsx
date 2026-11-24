import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { SIGN_IN_MESSAGES, signInProblem } from "@shared/sign-in";
import { FIXTURES } from "@/config";
import { fixtureJoin, fixtureSignIn, fixtureSignedIn, onFixtureChange } from "@/api/fixtures";
import { supabase } from "./supabase";

// Who is signed in on this phone. The session itself lives in the Keychain
// (./supabase.ts); this only says whether there is one, and refreshes the
// token while the app is open (Supabase's own advice for React Native).
type Auth = { ready: boolean; signedIn: boolean; email: string | null };

const AuthContext = createContext<Auth>({ ready: false, signedIn: false, email: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Auth>(
    FIXTURES ? { ready: true, signedIn: fixtureSignedIn(), email: "marcus@example.com" } : { ready: false, signedIn: false, email: null }
  );

  useEffect(() => {
    // The example build: whoever the example is, followed as it moves
    // (a run that joins free signs itself in).
    if (FIXTURES) return onFixtureChange(() => setAuth({ ready: true, signedIn: fixtureSignedIn(), email: "marcus@example.com" }));
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAuth({ ready: true, signedIn: Boolean(data.session), email: data.session?.user.email ?? null });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ ready: true, signedIn: Boolean(session), email: session?.user.email ?? null });
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => {
      alive = false;
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  const value = useMemo(() => auth, [auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  return useContext(AuthContext);
}

// The token the app API is called with; refreshed by Supabase when due.
export async function accessToken(): Promise<string | null> {
  if (FIXTURES) return "fixture.fixture.fixture";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// The website's own words for every way a sign-in can fail.
export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!email.trim() || !password) return SIGN_IN_MESSAGES.missing;
  if (FIXTURES) {
    fixtureSignIn();
    return null;
  }
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? SIGN_IN_MESSAGES[signInProblem(error)] : null;
}

// Right after a free account is made (app/join): signed in with the email
// and password just chosen, the same way as any sign-in.
export async function signInAfterJoin(email: string, password: string): Promise<string | null> {
  if (FIXTURES) {
    fixtureJoin();
    return null;
  }
  return signInWithPassword(email, password);
}

export async function signOutHere(): Promise<void> {
  if (FIXTURES) return;
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}
