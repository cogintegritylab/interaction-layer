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

export type CompositionRecord = {
  id: string;
  text: string;
  created_at: string;
  signature: string;
};
