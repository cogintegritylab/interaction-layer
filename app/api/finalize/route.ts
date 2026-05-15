import { type NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { generateId, signRecord } from "@/lib/crypto";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 100_000;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text =
    body && typeof body === "object" && "text" in body
      ? (body as { text: unknown }).text
      : undefined;

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text exceeds ${MAX_TEXT_LENGTH.toLocaleString()} characters` },
      { status: 400 }
    );
  }

  const id = generateId();
  const createdAt = new Date().toISOString();
  const signature = signRecord({ id, text, createdAt });

  try {
    const sql = getSql();
    await sql`
      INSERT INTO compositions (id, text, created_at, signature)
      VALUES (${id}, ${text}, ${createdAt}, ${signature})
    `;
  } catch (err) {
    console.error("DB insert failed:", err);
    return NextResponse.json(
      { error: "Could not save the composition. Please try again." },
      { status: 500 }
    );
  }

  const verifyUrl = `${request.nextUrl.origin}/verify/${id}`;
  return NextResponse.json({ id, verifyUrl });
}
