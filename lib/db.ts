import { neon } from "@neondatabase/serverless";

let cached: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (cached) return cached;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  cached = neon(process.env.DATABASE_URL);
  return cached;
}

// What the DB stores. Note: no text/content. Only the receipt and signature.
export type StoredRecord = {
  id: string;
  receipt_canonical: string;
  signature: string;
};
