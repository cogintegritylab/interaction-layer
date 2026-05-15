// Deterministic canonicalization. Both the issuer and any verifier must produce
// byte-identical canonical forms; otherwise signatures won't verify.

export function canonicalText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function canonicalReceiptJSON(
  receipt: Record<string, string>
): string {
  const sortedKeys = Object.keys(receipt).sort();
  const sorted: Record<string, string> = {};
  for (const k of sortedKeys) sorted[k] = receipt[k];
  return JSON.stringify(sorted);
}
