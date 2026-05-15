import { NextResponse, type NextRequest } from "next/server";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  computeCsrfToken,
  generateSessionId,
  signSessionId,
  verifySessionCookie,
} from "@/lib/session";

// Issue or refresh session and CSRF cookies on visits to the composition page.
// Only runs on `/` — verify pages, /about, and API routes are excluded by the
// matcher below, so cookies are never set for users who only consume verify
// links or read about the project. Composition is the only flow that needs
// session-scoped signing.

export async function middleware(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  const verifiedSessionId = await verifySessionCookie(existing);

  const response = NextResponse.next();

  if (!verifiedSessionId) {
    const newSessionId = generateSessionId();
    const signedCookie = await signSessionId(newSessionId);
    const csrfToken = await computeCsrfToken(newSessionId);

    const cookieOptions = {
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    };

    response.cookies.set(SESSION_COOKIE, signedCookie, {
      ...cookieOptions,
      httpOnly: true,
    });
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      ...cookieOptions,
      httpOnly: false, // The client reads this and echoes it in X-CSRF-Token.
    });
  }

  return response;
}

export const config = {
  matcher: ["/"],
};
