import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("");
  console.error("DATABASE_URL is not set.");
  console.error(
    "Make sure .env.development.local contains DATABASE_URL=... (run `npx vercel env pull --environment=production .env.development.local` if not)."
  );
  console.error("");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

try {
  await sql`
    CREATE TABLE IF NOT EXISTS compositions (
      id text PRIMARY KEY,
      receipt_canonical text NOT NULL,
      signature text NOT NULL
    )
  `;

  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'compositions'
  `;

  if (rows.length === 0) {
    throw new Error("Table was not found after creation.");
  }

  console.log("");
  console.log("Table 'compositions' is ready.");
  console.log("");
} catch (err) {
  console.error("");
  console.error("Database setup failed:");
  console.error(err);
  console.error("");
  process.exit(1);
}
