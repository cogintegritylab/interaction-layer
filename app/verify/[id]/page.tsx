import { getSql, type CompositionRecord } from "@/lib/db";
import { verifyRecord } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Verification — AI-Free Composition",
};

const EXPLAINER_PARAGRAPH = `This page confirms that the text above was submitted through a tool that blocked paste, copy, and drag operations during composition, and that the text and timestamp have not been altered since they were cryptographically signed. This does not, by itself, prove authorship, only that the person typed it themselves.`;

type Status = "verified" | "tampered" | "not_found";

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let status: Status = "not_found";
  let record: CompositionRecord | null = null;

  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT id, text, created_at, signature
      FROM compositions
      WHERE id = ${id}
      LIMIT 1
    `) as unknown as CompositionRecord[];

    if (rows.length > 0) {
      record = rows[0];
      const createdAtIso = new Date(record.created_at).toISOString();

      const valid = verifyRecord({
        id: record.id,
        text: record.text,
        createdAt: createdAtIso,
        signature: record.signature,
      });
      status = valid ? "verified" : "tampered";
    }
  } catch (err) {
    console.error("Verify lookup failed:", err);
  }

  if (status === "not_found" || record === null) {
    return (
      <main style={pageStyle}>
        <div style={badgeStyle("red")}>Not found</div>
        <p style={mutedStyle}>
          This verification link is invalid or has been removed.
        </p>
      </main>
    );
  }

  const formattedTime = new Date(record.created_at).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  return (
    <main style={pageStyle}>
      <div style={badgeStyle(status === "verified" ? "green" : "red")}>
        {status === "verified"
          ? "Verified"
          : "Signature does not verify — text or timestamp may have been altered"}
      </div>

      <div style={textBoxStyle}>{record.text}</div>

      <p style={mutedStyle}>Composed {formattedTime}</p>

      <section>
        <h2 style={subheadingStyle}>About this verification</h2>
        <p style={paragraphStyle}>{EXPLAINER_PARAGRAPH}</p>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b6b6b",
  fontSize: "0.9rem",
};

const subheadingStyle: React.CSSProperties = {
  margin: "0 0 0.5rem 0",
  fontSize: "0.85rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b6b6b",
};

const textBoxStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  fontFamily: "inherit",
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#1a1a1a",
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 6,
  padding: "1rem 1.25rem",
};

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  lineHeight: 1.6,
  color: "#333",
};

function badgeStyle(color: "green" | "red"): React.CSSProperties {
  const palette =
    color === "green"
      ? { bg: "#eafaf0", border: "#b8e6c8", fg: "#1f6a3d" }
      : { bg: "#fdecec", border: "#f5c4c4", fg: "#7a1a1a" };
  return {
    alignSelf: "flex-start",
    padding: "0.5rem 0.9rem",
    fontSize: "0.95rem",
    fontWeight: 600,
    color: palette.fg,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
  };
}
