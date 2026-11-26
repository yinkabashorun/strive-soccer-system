import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/elite/supabase/middleware";
import { appScreenRedirect } from "@/lib/elite/app-review";

// Every signed-in area. The session token is refreshed here on every page
// of these areas.
//
// EVERY signed-in area is listed (tests/session-refresh.test.ts holds
// this): a token refreshed while a page renders can only be saved when
// the middleware ran for that page, and a cookie the server sets is the
// one the iPhone app keeps (script-written cookies are capped at 7 days
// by WebKit).
export const SESSION_AREAS = [
  "/",
  "/dashboard/:path*",
  "/homework/:path*",
  "/progress/:path*",
  "/you/:path*",
  "/courses/:path*",
  "/film/:path*",
  "/messages/:path*",
  "/onboarding/:path*",
  "/coach/:path*",
  "/account/:path*",
  // a new account types the code from its email here (093)
  "/confirm-email",
  "/log/:path*",
  "/join",
  // Strive Pro sign-up: the server signs the new account in (074)
  "/pro/join",
  "/login",
  "/signup",
];

function inSessionArea(path: string): boolean {
  return SESSION_AREAS.some((area) => {
    if (area === "/") return path === "/";
    if (area.endsWith("/:path*")) {
      const base = area.slice(0, -"/:path*".length);
      return path === base || path.startsWith(base + "/");
    }
    return path === area;
  });
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Inside the App Store app, only screens a reviewed build describes are
  // drawn (lib/elite/app-review.ts, punch list A25).
  const elsewhere = appScreenRedirect(path, request.headers.get("user-agent"));
  if (elsewhere && elsewhere !== path) {
    const to = request.nextUrl.clone();
    to.pathname = elsewhere;
    to.search = "";
    return NextResponse.redirect(to);
  }

  if (!inSessionArea(path)) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  // Every page. The API, Next's own files and anything with a file
  // extension (icons, the manifest, drill clips) are left alone.
  matcher: ["/((?!api/|_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
