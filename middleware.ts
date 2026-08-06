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
  const cookieOptions = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  // Ensure a valid session cookie exists. If the current one is missing or
  // invalid (fresh visit, cleared cookies, etc.), rotate to a new session.
  let sessionId: string;
  if (verifiedSessionId) {
    sessionId = verifiedSessionId;
  } else {
    sessionId = generateSessionId();
    const signedCookie = await signSessionId(sessionId);
    response.cookies.set(SESSION_COOKIE, signedCookie, {
      ...cookieOptions,
      httpOnly: true,
    });
  }

  // Always ensure the CSRF cookie is set. It is client-readable
  // (httpOnly: false) so it can be sent back in X-CSRF-Token headers, and
  // client-readable cookies are more susceptible to eviction than
  // HTTP-only ones — iOS Safari's Intelligent Tracking Prevention in
  // particular has been observed to purge the CSRF cookie while leaving
  // the session cookie intact, which previously left the client with a
  // valid session but no way to prove it on POSTs. Re-setting on every /
  // request is idempotent (the token is a deterministic function of the
  // session id) and self-heals that state.
  const csrfToken = await computeCsrfToken(sessionId);
  response.cookies.set(CSRF_COOKIE, csrfToken, {
    ...cookieOptions,
    httpOnly: false,
  });

  return response;
}

export const config = {
  matcher: ["/"],
};
