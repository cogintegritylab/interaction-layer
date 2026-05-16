import {
  CURRENT_CANONICAL_TEXT_V,
  canonicalText,
  type CanonicalTextVersion,
} from "./canonical";

// Hex-encoded SHA-256 of the input bytes.
// `input` may be a UTF-8 string (encoded automatically) or a byte array.
export async function sha256Hex(
  input: string | Uint8Array
): Promise<string> {
  const source =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// SHA-256 of the canonicalized UTF-8 bytes of the text, under the specified
// canonical-text version. Defaults to the current version for new receipts;
// verifiers should pass the version recorded in the receipt being checked.
export async function hashText(
  text: string,
  version: CanonicalTextVersion = CURRENT_CANONICAL_TEXT_V
): Promise<string> {
  return sha256Hex(canonicalText(text, version));
}
