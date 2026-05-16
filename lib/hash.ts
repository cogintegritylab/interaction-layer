import { canonicalText } from "./canonical";

// Hex-encoded SHA-256 of the input bytes.
// `input` may be a UTF-8 string (encoded automatically) or a byte array.
export async function sha256Hex(
  input: string | Uint8Array
): Promise<string> {
  const source =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  // Copy into a fresh ArrayBuffer to satisfy strict BufferSource typing across
  // runtimes (Node and browsers differ on whether Uint8Array.buffer is
  // assignable to ArrayBuffer).
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// SHA-256 over the canonicalized UTF-8 bytes of the text.
// Works in both Node.js (>= 19) and modern browsers — both expose
// crypto.subtle globally with the same API.
export async function hashText(text: string): Promise<string> {
  return sha256Hex(canonicalText(text));
}
