import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { base64ToBytes, oneFileForm } from "@/lib/elite/upload-body";

// The native iPhone app (mobile/): what only shows on a real phone, held
// here so it cannot come back. (It lives with the site's tests because it
// reads the app's files as text, and the app's own tests are typed for a
// phone, with no Node. It never IMPORTS the app's code: the machine that
// runs the site's tests has only the site's packages.) Each of these was found on the first TestFlight build of the native app
// (Nov 23 2026): the profile photo never left the phone, the camera never
// opened, the sign-in keyboard could not be put away.

const root = path.resolve(__dirname, "../mobile");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const sources = [...files(path.join(root, "app")), ...files(path.join(root, "src"))];
const rel = (f: string) => path.relative(root, f);
const read = (f: string) => readFileSync(f, "utf8");
// code only: a rule explained in a comment is not a use of the thing
const code = (f: string) =>
  read(f)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

describe("a file upload from the phone", () => {
  it("base64 from the image tool decodes to the same bytes, at every length", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 255, 256, 1000, 4097]) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 31 + n) % 256);
      const text = Buffer.from(bytes).toString("base64");
      expect(Array.from(base64ToBytes(text)), `length ${n}`).toEqual(Array.from(bytes));
      // line breaks and url-safe padding quirks from a tool do not matter
      expect(base64ToBytes(text.replace(/(.{60})/g, "$1\n")).length).toBe(n);
    }
  });

  it("arrives at the server as the photo, byte for byte", async () => {
    // every byte value, plus the sequences a multipart parser trips on
    const tricky = [...Buffer.from("\r\n--\r\n----StriveEliteUpload\r\n\r\n")];
    const bytes = Uint8Array.from([0xff, 0xd8, ...Array.from({ length: 256 }, (_, i) => i), ...tricky, 0xff, 0xd9]);
    const form = oneFileForm("photo", "photo.jpg", "image/jpeg", bytes);
    expect(form.contentType).toMatch(/^multipart\/form-data; boundary=----StriveEliteUpload[A-Za-z0-9]{24}$/);
    // the same call the site's photo route makes
    const req = new Request("https://thestriveapp.com/api/app/profile/photo", {
      method: "POST",
      headers: { "content-type": form.contentType },
      body: form.body as unknown as BodyInit,
    });
    const file = (await req.formData()).get("photo");
    expect(file).toBeInstanceOf(Blob);
    const got = file as File;
    expect(got.type).toBe("image/jpeg");
    expect(got.name).toBe("photo.jpg");
    expect(Array.from(new Uint8Array(await got.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it("is never a FormData, and never a fetch of a file on the phone", () => {
    // This Expo version's fetch refuses a React Native file part
    // ({ uri, name, type }): the request never leaves the phone.
    for (const f of sources) {
      expect(code(f), rel(f)).not.toMatch(/new FormData\b/);
    }
    const fetchers = sources.filter((f) => /(^|[^.\w])fetch\(/.test(code(f))).map(rel);
    expect(fetchers).toEqual(["src/api/client.ts"]);
    expect(code(path.join(root, "src/profile-api.ts"))).toContain("base64: true");
  });
});

describe("the camera", () => {
  it("is asked for before it is opened, and a no is said plainly", () => {
    for (const f of sources) {
      const src = code(f);
      if (!src.includes("launchCameraAsync")) continue;
      expect(src.indexOf("requestCameraPermissionsAsync"), rel(f)).toBeGreaterThan(-1);
      expect(src.indexOf("requestCameraPermissionsAsync"), rel(f)).toBeLessThan(src.indexOf("launchCameraAsync("));
      expect(src, rel(f)).toContain("Linking.openSettings()");
    }
    expect(code(path.join(root, "src/ProfileSteps.tsx"))).toContain("launchCameraAsync");
  });
});

describe("the keyboard", () => {
  const form = "src/FormScreen.tsx";

  it("is handled in one place", () => {
    const src = code(path.join(root, form));
    expect(src).toContain('keyboardShouldPersistTaps="handled"');
    expect(src).toContain("keyboardDismissMode");
    expect(src).toContain("KeyboardAvoidingView");
    const others = sources.filter((f) => rel(f) !== form && /KeyboardAvoidingView/.test(code(f))).map(rel);
    expect(others).toEqual([]);
  });

  it("every screen with something to type sits in that one place", () => {
    const typed = sources.filter((f) => /<TextInput\b/.test(code(f)));
    expect(typed.length).toBeGreaterThan(5);
    // a piece that holds a field, and the screens that show that piece
    const pieces = typed.filter((f) => rel(f).startsWith("src/"));
    for (const f of typed.filter((t) => rel(t).startsWith("app/"))) {
      expect(code(f), rel(f)).toMatch(/<FormScreen\b/);
    }
    for (const piece of pieces) {
      const name = path.basename(piece).replace(/\.tsx?$/, "");
      const hosts = sources.filter((f) => rel(f).startsWith("app/") && code(f).includes(`@/${name}"`));
      expect(hosts.length, `${name} is shown somewhere`).toBeGreaterThan(0);
      for (const h of hosts) expect(code(h), `${rel(h)} shows ${name}`).toMatch(/<FormScreen\b/);
    }
  });
});

describe("the sign-in screen", () => {
  const src = read(path.join(root, "app/sign-in.tsx"));
  it("says whose app it is", () => {
    expect(src).toMatch(/Strive <Text[^>]*>Elite<\/Text>/);
    expect(src).toContain("Sign in to your Strive Elite account");
  });
  it("Next on the email moves to the password", () => {
    expect(src).toContain("passwordField.current?.focus()");
  });
});
