// Session and CSRF management.
//
// Uses Web Crypto throughout so the same code runs in both the Edge runtime
// (middleware.ts) and the Node.js runtime (api routes). All functions are
// async because Web Crypto subtle is async.

export const SESSION_COOKIE = "aife_session";
export const CSRF_COOKIE = "aife_csrf";

let cachedKey: CryptoKey | null = null;

// Derive an HMAC key from the existing signing private key. This avoids
// introducing a separate SESSION_SECRET env var. The derived key is not the
// signing private key itself; it's a domain-separated HMAC derivative.
async function getSecretKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const privateKeyB64 = process.env.SIGNING_PRIVATE_KEY;
  if (!privateKeyB64) {
    throw new Error("SIGNING_PRIVATE_KEY is not set");
  }
  const seed = new TextEncoder().encode(privateKeyB64 + ":aife-session-v1");
  const hashed = await crypto.subtle.digest("SHA-256", seed);
  cachedKey = await crypto.subtle.importKey(
    "raw",
    hashed,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return cachedKey;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacBase64Url(key: CryptoKey, data: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function signSessionId(sessionId: string): Promise<string> {
  const key = await getSecretKey();
  const sig = await hmacBase64Url(key, sessionId);
  return `${sessionId}.${sig}`;
}

export async function verifySessionCookie(
  value: string | undefined
): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  const key = await getSecretKey();
  const expected = await hmacBase64Url(key, sessionId);
  // Constant-time string comparison.
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0 ? sessionId : null;
}

export async function computeCsrfToken(sessionId: string): Promise<string> {
  const key = await getSecretKey();
  return hmacBase64Url(key, sessionId + ":csrf");
}
