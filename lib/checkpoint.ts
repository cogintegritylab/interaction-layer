// Checkpoint payload construction and signing (protocol v2).
// See SPEC.md §4 for the payload schema and §5 for canonicalization.

import { canonicalReceiptJSON } from "./canonical";
import { KEY_ID } from "./public-key";

export const PROTOCOL_V2 = "interaction-layer/v2";
export const ISSUER = "Cognitive Integrity Lab";
export const HASH_ALGORITHM = "sha-256";
export const CANONICAL_TEXT_V = 1;

export type CheckpointType = "checkpoint" | "final";

export type CheckpointPayload = {
  v: string;
  type: CheckpointType;
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
  payload: CheckpointPayload;
  signature: string;
  kid: string;
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

export async function signCheckpoint(
  payload: CheckpointPayload,
  privateKeyBase64: string
): Promise<SignedCheckpoint> {
  const canonical = canonicalReceiptJSON(
    payload as unknown as Record<string, string | number>
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
  return {
    payload,
    signature: bytesToBase64(new Uint8Array(sigBuf)),
    kid: KEY_ID,
  };
}
