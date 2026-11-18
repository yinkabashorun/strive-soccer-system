import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SIGN_IN_MESSAGES,
  newPasswordProblem,
  signInLanding,
  signInProblem,
  type SignInProblem,
} from "../lib/elite/sign-in";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Signing in happens on the server (App Store punch list A18). A session
// cookie the browser writes itself is capped at 7 days on an iPhone, so a
// member who skipped a week was signed out. These hold the one path.

describe("where a person lands after signing in", () => {
  it("a player goes home, a coach or the owner goes to the coach side", () => {
    expect(signInLanding({ role: "player" })).toBe("/dashboard");
    expect(signInLanding({ role: null })).toBe("/dashboard");
    expect(signInLanding({ role: "coach" })).toBe("/coach");
    expect(signInLanding({ role: "admin" })).toBe("/coach");
  });

  it("honours next only when it is a path on our own site", () => {
    expect(signInLanding({ role: "player", next: "/film" })).toBe("/film");
    expect(signInLanding({ role: "coach", next: "/coach/calls" })).toBe("/coach/calls");
    expect(signInLanding({ role: "player", next: "https://evil.example/x" })).toBe("/dashboard");
    expect(signInLanding({ role: "player", next: "//evil.example" })).toBe("/dashboard");
    expect(signInLanding({ role: "coach", next: "" })).toBe("/coach");
  });
});

describe("every way signing in can fail has one plain line", () => {
  it("reads the sign-in service's errors", () => {
    expect(signInProblem({ message: "Invalid login credentials", status: 400 })).toBe("wrong");
    expect(signInProblem({ code: "invalid_credentials", status: 400 })).toBe("wrong");
    expect(signInProblem({ message: "Email not confirmed", status: 400 })).toBe("unconfirmed");
    expect(signInProblem({ status: 429, message: "Request rate limit reached" })).toBe("too_many");
    expect(signInProblem({ name: "AuthRetryableFetchError", status: 0, message: "" })).toBe("unreachable");
    expect(signInProblem(new TypeError("fetch failed"))).toBe("unreachable");
    expect(signInProblem({ status: 503, message: "upstream" })).toBe("unreachable");
    expect(signInProblem({ status: 418, message: "odd" })).toBe("unknown");
    expect(signInProblem(null)).toBe("unknown");
  });

  it("never shows a blank or the service's own wording, and stays in the house voice", () => {
    const kinds: SignInProblem[] = [
      "missing",
      "wrong",
      "unconfirmed",
      "too_many",
      "unreachable",
      "not_configured",
      "unknown",
    ];
    for (const kind of kinds) {
      const line = SIGN_IN_MESSAGES[kind];
      expect(line.length, kind).toBeGreaterThan(20);
      expect(line, kind).not.toMatch(/[—–]/);
      expect(line, kind).not.toMatch(/invalid login credentials|AuthApiError|supabase/i);
      expect(line, kind).not.toMatch(/!/);
    }
    // a wrong password never says which half was wrong
    expect(SIGN_IN_MESSAGES.wrong).toMatch(/email and password/);
  });
});

describe("a new password from the reset link", () => {
  it("needs eight characters and the same thing typed twice", () => {
    expect(newPasswordProblem({ password: "short", confirm: "short" })).toMatch(/at least 8/);
    expect(newPasswordProblem({ password: "longenough", confirm: "longenougH" })).toMatch(/don't match/);
    expect(newPasswordProblem({ password: "longenough", confirm: "longenough" })).toBeNull();
  });
});

// The guard: nothing a browser runs may sign anyone in or set a password.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("one path: the browser never signs in", () => {
  const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
  const SESSION_CALLS = /\.auth\.(signInWithPassword|signInWithOtp|signInWithOAuth|updateUser|setSession|exchangeCodeForSession|verifyOtp)\s*\(/;

  it("no client component calls the sign-in service to start or change a session", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const isClient = /^\s*["']use client["']/.test(src);
      if (isClient && SESSION_CALLS.test(src)) offenders.push(file.replace(root + "/", ""));
    }
    expect(offenders).toEqual([]);
  });

  it("password sign-in lives in exactly the server files that own it", () => {
    const callers = files
      .filter((f) => /\.auth\.signInWithPassword\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(root + "/", ""))
      .sort();
    expect(callers).toEqual([
      "lib/elite/auth-actions.ts", // the sign-in screen
      "lib/elite/session-start.ts", // a brand-new account, signed in by the server
      "lib/elite/supabase/server.ts", // verifyPassword: a throwaway check, no session kept
    ]);
  });

  it("both routes that create an account sign it in through the one server helper", () => {
    for (const route of ["app/api/elite/auth/redeem/route.ts", "app/api/elite/auth/join/route.ts"]) {
      const src = read(route);
      expect(src, route).toContain('import { establishSession } from "@/lib/elite/session-start"');
      expect(src, route).toContain("signedIn");
      expect(src, route).toContain("await establishSession(");
      // and never a client of its own for it
      expect(src, route).not.toMatch(/import \{[^}]*\bcreateClient\b[^}]*\} from "@\/lib\/elite\/supabase\/server"/);
    }
    const helper = read("lib/elite/session-start.ts");
    expect(helper).toContain('from "./supabase/server"');
    expect(helper).not.toMatch(/^\s*["']use client["']/);
  });

  it("the free sign-up form follows the invite form: the server signed them in, or they go to sign in", () => {
    const form = read("components/elite/JoinForm.tsx");
    expect(form).toContain("if (!data.signedIn) {");
    expect(form).toContain('router.push("/login")');
    expect(form).not.toContain("sessionStorage");
    expect(form).not.toContain("window.location");
  });

  it("the sign-in, sign-up and reset forms do not load the browser database client", () => {
    for (const form of ["LoginForm", "SignupForm", "JoinForm", "ResetForm", "ChangePasswordForm"]) {
      expect(read(`components/elite/${form}.tsx`), form).not.toContain("supabase/client");
    }
  });

  it("the sign-in form posts to the server action and carries next along", () => {
    const form = read("components/elite/LoginForm.tsx");
    expect(form).toContain("useFormState(signIn");
    expect(form).toContain('name="next"');
    expect(form).toContain('name="email"');
    expect(form).toContain('name="password"');
  });

  it("the server actions use the shared server client, so the cookie is set by the server", () => {
    const actions = read("lib/elite/auth-actions.ts");
    expect(actions).toMatch(/^"use server";/);
    expect(actions).toContain('from "./supabase/server"');
    expect(actions).toContain("export async function signIn(");
    expect(actions).toContain("export async function setNewPassword(");
    expect(actions).not.toContain("createBrowserClient");
  });
});

describe("saved passwords on the sign-in screen (A23, the field)", () => {
  it("the email field is marked as the user name, the password as the current one", () => {
    const form = read("components/elite/LoginForm.tsx");
    expect(form).toMatch(/type="email"[\s\S]{0,260}autoComplete="username"/);
    expect(form).toContain('autoComplete="current-password"');
    expect(form).not.toContain('autoComplete="email"');
  });

  it("forms that set a password say it is a new one", () => {
    expect(read("components/elite/ResetForm.tsx")).toContain('autoComplete="new-password"');
    expect(read("components/elite/SignupForm.tsx")).toContain('autoComplete="new-password"');
    expect(read("components/elite/JoinForm.tsx")).toContain('autoComplete="new-password"');
    expect(read("components/elite/JoinForm.tsx")).toMatch(/type="email"[\s\S]{0,200}autoComplete="username"/);
  });
});
