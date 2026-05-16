import {
  CURRENT_CANONICAL_TEXT_V,
  canonicalReceiptJSON,
} from "./canonical";
import { hashText } from "./hash";
import { KEY_ID, PUBLIC_KEY_BASE64 } from "./public-key";

export const PROTOCOL = "interaction-layer/v1";
export const ISSUER = "Cognitive Integrity Lab";
export const HASH_ALGORITHM = "sha-256";

export type Mode = "ai_free";

export type Receipt = {
  protocol: string;
  mode: Mode;
  hash_algorithm: string;
  hash: string;
  issued_at: string;
  issuer: string;
  key_id: string;
  // Present on receipts created after canonical-text v2 shipped (2026-05-16).
  // Older receipts omit this field and are interpreted as v1.
  canonical_text_v?: number;
};

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buffer = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// SERVER ONLY. Builds a signed receipt over the canonical text.
// Returns the canonical receipt JSON (the exact bytes that were signed),
// the signature, and the receipt object for convenience.
export async function createSignedReceipt(
  text: string,
  mode: Mode,
  privateKeyBase64: string
): Promise<{ receipt: Receipt; canonical: string; signature: string }> {
  const hash = await hashText(text, CURRENT_CANONICAL_TEXT_V);
  const receipt: Receipt = {
    protocol: PROTOCOL,
    mode,
    hash_algorithm: HASH_ALGORITHM,
    hash,
    issued_at: new Date().toISOString(),
    issuer: ISSUER,
    key_id: KEY_ID,
    canonical_text_v: CURRENT_CANONICAL_TEXT_V,
  };
  const canonical = canonicalReceiptJSON(
    receipt as unknown as Record<string, string | number>
  );
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(privateKeyBase64),
    { name: "Ed25519" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    new TextEncoder().encode(canonical)
  );
  const signature = bytesToBase64(new Uint8Array(sigBuf));
  return { receipt, canonical, signature };
}

// UNIVERSAL. Verifies the signature against the canonical bytes,
// using the public key compiled into this module.
export async function verifySignature(
  canonical: string,
  signatureBase64: string
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(PUBLIC_KEY_BASE64),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    base64ToArrayBuffer(signatureBase64),
    new TextEncoder().encode(canonical)
  );
}

export function parseReceipt(canonical: string): Receipt {
  return JSON.parse(canonical) as Receipt;
}
