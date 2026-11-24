import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { checkUsername, myUsernameIdeas, saveUsername } from "@/lib/elite/profile-actions";

// The @username (081) from the iPhone app, through the website's own
// actions (lib/elite/profile-actions.ts): every rule, the rate limits and
// the unique index decide on the server, never on the phone.
//   GET                      a few ideas from their own name
//   POST { username, check } is this one free (as they type)
//   POST { username }        take it
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "username-ideas", access: "person" }, async () => ({
  ideas: await myUsernameIdeas(),
}));

export const POST = appRoute({ name: "username", access: "person" }, async ({ req }) => {
  const body = await readJson(req);
  if (typeof body?.username !== "string") return appJson({ ok: false, error: "Pick a username." }, 400);
  const name = body.username.slice(0, 64);
  return body.check === true ? checkUsername(name) : saveUsername(name);
});
