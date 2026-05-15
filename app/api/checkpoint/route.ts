// POST /api/checkpoint
// Issues a signed checkpoint for a hash submitted by the client.
// See SPEC.md §8 for the security posture and contract.

import { type NextRequest, NextResponse } from "next/server";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  computeCsrfToken,
  verifySessionCookie,
} from "@/lib/session";
import { checkAndIncrement } from "@/lib/rate-limit";
import {
  CANONICAL_TEXT_V,
  HASH_ALGORITHM,
  ISSUER,
  PROTOCOL_V2,
  type CheckpointPayload,
  type CheckpointType,
  signCheckpoint,
} from "@/lib/checkpoint";

export const runtime = "nodejs";

const ALLOWED_MODES = new Set(["ai_free"]);
const ALLOWED_TYPES = new Set<CheckpointType>(["checkpoint", "final"]);
const HEX64 = /^[0-9a-f]{64}$/;

function isValidPrevHash(value: unknown): boolean {
  return value === "genesis" || (typeof value === "string" && HEX64.test(value));
}

export async function POST(request: NextRequest) {
  // 1. Origin check. Requests must come from this site's own origin.
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  // 2. Session cookie check.
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = await verifySessionCookie(sessionCookie);
  if (!sessionId) {
    return NextResponse.json({ error: "no_session" }, { status: 403 });
  }

  // 3. CSRF check (double-submit cookie + header).
  const csrfHeader = request.headers.get("x-csrf-token");
  const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;
  const expectedCsrf = await computeCsrfToken(sessionId);
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie || csrfCookie !== expectedCsrf) {
    return NextResponse.json({ error: "csrf_mismatch" }, { status: 403 });
  }

  // 4. Rate limit.
  const rl = checkAndIncrement(sessionId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      }
    );
  }

  // 5. Parse and validate body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const docId = b.doc_id;
  const mode = b.mode;
  const textHash = b.text_hash;
  const prevHash = b.prev_checkpoint_hash;
  const typeField = (b.type ?? "checkpoint") as CheckpointType;

  if (typeof docId !== "string" || docId.length < 8 || docId.length > 32) {
    return NextResponse.json({ error: "invalid_doc_id" }, { status: 400 });
  }
  if (typeof mode !== "string" || !ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }
  if (typeof textHash !== "string" || !HEX64.test(textHash)) {
    return NextResponse.json({ error: "invalid_text_hash" }, { status: 400 });
  }
  if (!isValidPrevHash(prevHash)) {
    return NextResponse.json({ error: "invalid_prev_hash" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(typeField)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  // 6. Server is configured?
  if (!process.env.SIGNING_PRIVATE_KEY) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // 7. Build payload and sign.
  const payload: CheckpointPayload = {
    v: PROTOCOL_V2,
    type: typeField,
    doc_id: docId,
    mode,
    hash_algorithm: HASH_ALGORITHM,
    canonical_text_v: CANONICAL_TEXT_V,
    text_hash: textHash,
    prev_checkpoint_hash: prevHash as string,
    issued_at: new Date().toISOString(),
    issuer: ISSUER,
  };

  try {
    const signed = await signCheckpoint(payload, process.env.SIGNING_PRIVATE_KEY);
    return NextResponse.json(signed);
  } catch (err) {
    console.error("Checkpoint signing failed:", err);
    return NextResponse.json({ error: "sign_failed" }, { status: 500 });
  }
}
