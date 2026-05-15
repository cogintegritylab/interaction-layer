import { canonicalText } from "./canonical";

// SHA-256 over the canonicalized UTF-8 bytes of the text.
// Works in both Node.js (>= 19) and modern browsers — both expose
// crypto.subtle globally with the same API.
export async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalText(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
