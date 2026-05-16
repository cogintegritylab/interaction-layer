// .cogdoc parsing, validation, and verification.
// Implements SPEC.md §9 (verification algorithm) and §10 (UI states).
// All verification happens client-side; the pasted/loaded text never leaves
// the user's browser.

import {
  canonicalReceiptJSON,
  type CanonicalTextVersion,
} from "./canonical";
import { hashText, sha256Hex } from "./hash";
import { verifySignature } from "./receipt";

const PROTOCOL_V2 = "interaction-layer/v2";
const ALLOWED_KID = "cil-v1";
const ALLOWED_MODES = new Set(["ai_free"]);
const ALLOWED_HASH_ALG = "sha-256";
const ALLOWED_CANONICAL_TEXT_V = new Set<number>([1, 2]);

export type SignedCheckpointPayload = {
  v: string;
  type: "checkpoint" | "final";
  doc_id: string;
  mode: string;
  hash_algorithm: string;
  canonical_text_v: number;
  text_hash: string;
  prev_checkpoint_hash: string;
  issued_at: string;
  issuer: string;
};

export type SignedCheckpoint = {
  payload: SignedCheckpointPayload;
  signature: string;
  kid: string;
};

export type CogdocFile = {
  format_version: number;
  doc_id: string;
  mode: string;
  content: string;
  checkpoints: SignedCheckpoint[];
  final_receipt: SignedCheckpoint | null;
};

export type CogdocStatus =
  | "valid"
  | "no_checkpoint_yet"
  | "broken"
  | "invalid";

export type VerificationResult = {
  status: CogdocStatus;
  cogdoc: CogdocFile | null;
  reason: string | null;
};

function isCheckpointPayload(obj: unknown): obj is SignedCheckpointPayload {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  if (p.v !== PROTOCOL_V2) return false;
  if (p.type !== "checkpoint" && p.type !== "final") return false;
  if (typeof p.doc_id !== "string") return false;
  if (typeof p.mode !== "string") return false;
  if (p.hash_algorithm !== ALLOWED_HASH_ALG) return false;
  if (typeof p.canonical_text_v !== "number") return false;
  if (typeof p.text_hash !== "string") return false;
  if (typeof p.prev_checkpoint_hash !== "string") return false;
  if (typeof p.issued_at !== "string") return false;
  if (typeof p.issuer !== "string") return false;
  return true;
}

function isSignedCheckpoint(obj: unknown): obj is SignedCheckpoint {
  if (typeof obj !== "object" || obj === null) return false;
  const c = obj as Record<string, unknown>;
  if (typeof c.signature !== "string") return false;
  if (typeof c.kid !== "string") return false;
  if (!isCheckpointPayload(c.payload)) return false;
  return true;
}

function isCogdocStructure(obj: unknown): obj is CogdocFile {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.format_version !== "number") return false;
  if (typeof o.doc_id !== "string") return false;
  if (typeof o.mode !== "string") return false;
  if (typeof o.content !== "string") return false;
  if (!Array.isArray(o.checkpoints)) return false;
  if (
    o.final_receipt !== null &&
    !isSignedCheckpoint(o.final_receipt)
  ) {
    return false;
  }
  for (const cp of o.checkpoints) {
    if (!isSignedCheckpoint(cp)) return false;
  }
  return true;
}

function fail(reason: string): VerificationResult {
  return { status: "invalid", cogdoc: null, reason };
}

export async function verifyCogdoc(
  rawJson: string
): Promise<VerificationResult> {
  // 1. Parse JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return fail("File is not valid JSON.");
  }

  // 2. Structural validation.
  if (!isCogdocStructure(parsed)) {
    return fail("File does not match the .cogdoc format.");
  }
  const cogdoc = parsed;

  // 3. Format version.
  if (cogdoc.format_version !== 2) {
    return fail(`Unsupported format version: ${cogdoc.format_version}.`);
  }

  // 4. Mode.
  if (!ALLOWED_MODES.has(cogdoc.mode)) {
    return fail(`Unsupported mode: ${cogdoc.mode}.`);
  }

  // 5. doc_id length sanity.
  if (cogdoc.doc_id.length < 8 || cogdoc.doc_id.length > 32) {
    return fail("Invalid doc_id format.");
  }

  // 6. Empty chain.
  if (cogdoc.checkpoints.length === 0 && cogdoc.final_receipt === null) {
    return { status: "no_checkpoint_yet", cogdoc, reason: null };
  }

  // 7. Walk the checkpoint chain.
  let prevHash = "genesis";
  for (let i = 0; i < cogdoc.checkpoints.length; i++) {
    const cp = cogdoc.checkpoints[i];
    const label = `Checkpoint ${i + 1}`;

    if (cp.kid !== ALLOWED_KID) {
      return fail(`${label}: unknown issuer key (${cp.kid}).`);
    }
    if (cp.payload.doc_id !== cogdoc.doc_id) {
      return fail(`${label}: doc_id does not match file.`);
    }
    if (cp.payload.mode !== cogdoc.mode) {
      return fail(`${label}: mode does not match file.`);
    }
    if (cp.payload.type !== "checkpoint") {
      return fail(`${label}: wrong type (expected "checkpoint").`);
    }
    if (!ALLOWED_CANONICAL_TEXT_V.has(cp.payload.canonical_text_v)) {
      return fail(`${label}: unsupported canonical_text_v.`);
    }
    if (cp.payload.prev_checkpoint_hash !== prevHash) {
      return fail(`${label}: chain link broken.`);
    }

    const canonical = canonicalReceiptJSON(
      cp.payload as unknown as Record<string, string | number>
    );
    const sigOk = await verifySignature(canonical, cp.signature);
    if (!sigOk) {
      return fail(`${label}: signature does not verify.`);
    }
    prevHash = await sha256Hex(canonical);
  }

  // 8. Final receipt, if present.
  if (cogdoc.final_receipt) {
    const fr = cogdoc.final_receipt;
    if (fr.kid !== ALLOWED_KID) {
      return fail("Final receipt: unknown issuer key.");
    }
    if (fr.payload.doc_id !== cogdoc.doc_id) {
      return fail("Final receipt: doc_id does not match.");
    }
    if (fr.payload.mode !== cogdoc.mode) {
      return fail("Final receipt: mode does not match.");
    }
    if (fr.payload.type !== "final") {
      return fail("Final receipt: wrong type.");
    }
    if (!ALLOWED_CANONICAL_TEXT_V.has(fr.payload.canonical_text_v)) {
      return fail("Final receipt: unsupported canonical_text_v.");
    }
    if (fr.payload.prev_checkpoint_hash !== prevHash) {
      return fail("Final receipt: chain link broken.");
    }
    const canonical = canonicalReceiptJSON(
      fr.payload as unknown as Record<string, string | number>
    );
    const sigOk = await verifySignature(canonical, fr.signature);
    if (!sigOk) {
      return fail("Final receipt: signature does not verify.");
    }
  }

  // 9. Compare current text hash to the latest signed text hash, applying
  // the canonical-text version declared by the latest signed entry.
  const latestPayload = cogdoc.final_receipt
    ? cogdoc.final_receipt.payload
    : cogdoc.checkpoints[cogdoc.checkpoints.length - 1].payload;
  const latestSignedHash = latestPayload.text_hash;
  const currentHash = await hashText(
    cogdoc.content,
    latestPayload.canonical_text_v as CanonicalTextVersion
  );

  if (currentHash !== latestSignedHash) {
    return {
      status: "broken",
      cogdoc,
      reason:
        "The text in the file does not match the latest signed checkpoint.",
    };
  }

  return { status: "valid", cogdoc, reason: null };
}
