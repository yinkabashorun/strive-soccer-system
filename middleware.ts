import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/elite/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on the Strive Elite authenticated areas + auth pages so the
    // session cookie stays fresh. Skips static assets and API routes.
    "/dashboard/:path*",
    "/homework/:path*",
    "/progress/:path*",
    "/film/:path*",
    "/coach/:path*",
    "/login",
    "/signup",
  ],
};
