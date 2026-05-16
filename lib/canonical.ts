// Deterministic canonicalization. Both the issuer and any verifier must produce
// byte-identical canonical forms; otherwise signatures won't verify.
//
// Two versions of canonical text are defined here. The protocol version that
// produced a given receipt is recorded in its payload's `canonical_text_v`
// field; verifiers MUST apply the matching version.

export type CanonicalTextVersion = 1 | 2;

export const CURRENT_CANONICAL_TEXT_V: CanonicalTextVersion = 2;

// v1: preserves line structure. Used for receipts created before v2 shipped.
export function canonicalTextV1(input: string): string {
  return input
    .normalize("NFC")
    .replace(/ /g, " ")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// v2: whitespace-insensitive. Treats every run of whitespace (spaces, tabs,
// newlines, Unicode whitespace) as equivalent — a single space. The point is
// to make verification immune to reflow done by email clients (notably iOS
// Mail) that collapse paragraph breaks into spaces when content is pasted
// into their compose pane. Line structure is no longer cryptographically
// pinned; the words themselves remain bit-exact.
export function canonicalTextV2(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .join(" ");
}

export function canonicalText(
  input: string,
  version: CanonicalTextVersion = CURRENT_CANONICAL_TEXT_V
): string {
  return version === 1 ? canonicalTextV1(input) : canonicalTextV2(input);
}

export function canonicalReceiptJSON(
  receipt: Record<string, string | number>
): string {
  const sortedKeys = Object.keys(receipt).sort();
  const sorted: Record<string, string | number> = {};
  for (const k of sortedKeys) sorted[k] = receipt[k];
  return JSON.stringify(sorted);
}
