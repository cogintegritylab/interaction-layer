// Deterministic canonicalization. Both the issuer and any verifier must produce
// byte-identical canonical forms; otherwise signatures won't verify.

export function canonicalText(input: string): string {
  return input
    // Unicode normalization (NFC) so visually identical characters with
    // different code-point sequences (decomposed vs precomposed) hash the same.
    .normalize("NFC")
    // Mobile email auto-format frequently inserts these whitespace variants
    // in place of regular spaces; treat them as the spaces they visually are.
    .replace(/ /g, " ") // no-break space
    .replace(/ /g, " ") // narrow no-break space
    // Strip zero-width characters that some auto-format pipelines inject.
    .replace(/[​-‍﻿]/g, "")
    // Line ending normalization.
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function canonicalReceiptJSON(
  receipt: Record<string, string | number>
): string {
  const sortedKeys = Object.keys(receipt).sort();
  const sorted: Record<string, string | number> = {};
  for (const k of sortedKeys) sorted[k] = receipt[k];
  return JSON.stringify(sorted);
}
