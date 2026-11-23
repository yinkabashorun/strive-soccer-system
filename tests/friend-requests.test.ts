import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FRIEND_REQUESTS_FULL_MESSAGE, addFriendQuestion, friendRequestLine, requestSentLine } from "@/lib/elite/tracker";

// Friends by request (072, Coach Yinka Nov 20 2026: "friend requests is
// fine"). A link sends a request; only the link owner's Accept makes two
// players friends, so a link posted publicly cannot put a stranger in a
// 13 year old's friends.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const server = read("lib/elite/tracker-server.ts");
const fn = (name: string) => {
  const at = server.indexOf(`export async function ${name}(`);
  return server.slice(at, server.indexOf("\nexport ", at + 10));
};

describe("the table", () => {
  it("is written only by our server and holds one request a pair", () => {
    const sql = read("supabase/migrations/072_friend_requests.sql");
    expect(sql).toContain("primary key (requester, recipient)");
    expect(sql).toContain("check (requester <> recipient)");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/create policy/i);
  });
});

describe("sending a request", () => {
  const send = fn("requestFriend");
  it("never makes a pair on its own, except when both have asked each other", () => {
    expect((send.match(/makeFriends\(/g) ?? []).length).toBe(1);
    expect(send.indexOf("if (reverse)")).toBeLessThan(send.indexOf("makeFriends("));
  });
  it("respects a block, and quietly stops a player the owner took off", () => {
    expect(send.indexOf("blockedEitherWay(")).toBeLessThan(send.indexOf(".upsert("));
    expect(send).toMatch(/if \(removed\) return "sent";/);
  });
  it("caps the requests one player can have waiting", () => {
    expect(send).toContain("FRIEND_REQUESTS_PENDING_MAX");
  });
});

describe("answering", () => {
  const answer = fn("answerFriendRequest");
  it("acts only on a request addressed to the one answering", () => {
    expect(answer).toMatch(/\.eq\("requester", requester\)\s*\.eq\("recipient", recipient\)\s*\.maybeSingle\(\)/);
    expect(answer.indexOf('if (!request) return "none"')).toBeLessThan(answer.indexOf("makeFriends("));
    expect(answer.indexOf('if (!accept) return "ok"')).toBeLessThan(answer.indexOf("makeFriends("));
  });
  it("the action takes the one answering from the session", () => {
    const actions = read("lib/elite/tracker-actions.ts");
    expect(actions).toContain("answerFriendRequestFor(o.profileId, requesterId, accept === true)");
  });
  it("a request shows a name and initials, never a photo, until accepted", () => {
    const list = fn("friendRequestsFor");
    expect(list).not.toMatch(/avatar|photo/i);
  });
});

describe("nothing else makes friends from a link", () => {
  it("only the request paths and clubs pair players", () => {
    const callers = readdirSync(join(root, "app", "api", "elite", "auth"))
      .map((d) => read(`app/api/elite/auth/${d}/route.ts`))
      .filter((src) => src.includes("makeFriends"));
    expect(callers).toEqual([]);
  });
});

describe("the words", () => {
  it("say what happens, in plain words", () => {
    expect(addFriendQuestion("Marcus B.")).toBe("Send Marcus B. a friend request?");
    expect(friendRequestLine("Marcus B.")).toContain("When Marcus B. accepts");
    expect(requestSentLine("Marcus B.")).toContain("once Marcus B. accepts");
    for (const line of [friendRequestLine("A"), requestSentLine("A"), FRIEND_REQUESTS_FULL_MESSAGE]) {
      expect(line).not.toMatch(/—/);
    }
  });
});
