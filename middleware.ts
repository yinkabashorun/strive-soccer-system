import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/elite/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on the Strive Elite authenticated areas + auth pages so the
    // session cookie stays fresh. Skips static assets and API routes.
    //
    // EVERY signed-in area is listed (tests/session-refresh.test.ts holds
    // this): a token refreshed while a page renders can only be saved when
    // the middleware ran for that page, and a cookie the server sets is the
    // one the iPhone app keeps (script-written cookies are capped at 7 days
    // by WebKit).
    "/",
    "/dashboard/:path*",
    "/homework/:path*",
    "/progress/:path*",
    "/courses/:path*",
    "/film/:path*",
    "/messages/:path*",
    "/onboarding/:path*",
    "/coach/:path*",
    "/account/:path*",
    "/log/:path*",
    "/join",
    "/login",
    "/signup",
  ],
};
