"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { hashText } from "@/lib/hash";
import { parseReceipt, verifySignature, type Receipt } from "@/lib/receipt";
import { PUBLIC_KEY_BASE64 } from "@/lib/public-key";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "valid" }
  | { kind: "invalid_hash" }
  | { kind: "invalid_signature" }
  | { kind: "error"; message: string };

export default function VerifyClient({
  receiptCanonical,
  signature,
}: {
  receiptCanonical: string;
  signature: string;
}) {
  const receipt: Receipt = useMemo(
    () => parseReceipt(receiptCanonical),
    [receiptCanonical]
  );

  const [pastedText, setPastedText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [signatureOK, setSignatureOK] = useState<boolean | null>(null);

  // Verify the signature once on load (independent of pasted text).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await verifySignature(receiptCanonical, signature);
        if (!cancelled) setSignatureOK(ok);
      } catch (err) {
        console.error("Signature verify error:", err);
        if (!cancelled) setSignatureOK(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptCanonical, signature]);

  // Re-check the pasted text against the receipt's hash whenever it changes.
  useEffect(() => {
    if (pastedText.length === 0) {
      setStatus({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setStatus({ kind: "checking" });
    (async () => {
      try {
        if (signatureOK === false) {
          if (!cancelled) setStatus({ kind: "invalid_signature" });
          return;
        }
        const pastedHash = await hashText(pastedText);
        if (cancelled) return;
        if (pastedHash !== receipt.hash) {
          setStatus({ kind: "invalid_hash" });
          return;
        }
        if (signatureOK === null) {
          // Still verifying signature; will be reported via the effect below.
          return;
        }
        setStatus({ kind: "valid" });
      } catch (err) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : "Verification failed",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pastedText, receipt.hash, signatureOK]);

  const formattedTime = formatTimestamp(receipt.issued_at);
  const verifyUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <p style={kickerStyle}>Cognitive Integrity Lab · interaction layer</p>
        <h1 style={headingStyle}>Verify a composition receipt</h1>
        <p style={mutedStyle}>
          Paste the message you received (the text above the verify line) into
          the box below. Everything happens in your browser; the pasted text is
          not sent anywhere.
        </p>
      </header>

      <textarea
        value={pastedText}
        onChange={(e) => setPastedText(e.target.value)}
        placeholder="Paste the text from the message here…"
        spellCheck={false}
        style={textareaStyle}
      />

      <StatusBanner status={status} />

      <section style={detailSectionStyle}>
        <h2 style={subheadingStyle}>Receipt details</h2>
        <dl style={dlStyle}>
          <DetailRow label="Issuer" value={receipt.issuer} />
          <DetailRow label="Mode" value={receipt.mode} mono />
          <DetailRow label="Protocol" value={receipt.protocol} mono />
          <DetailRow label="Issued at" value={formattedTime} />
          <DetailRow label="Key ID" value={receipt.key_id} mono />
          <DetailRow
            label="Hash algorithm"
            value={receipt.hash_algorithm}
            mono
          />
          <DetailRow label="Text hash" value={receipt.hash} mono breakAll />
        </dl>
      </section>

      <section style={detailSectionStyle}>
        <h2 style={subheadingStyle}>How does this work?</h2>
        <div style={qaStyle}>
          <QA q="Is this AI detection?">
            No. This page does not look at the prose at all. AI detaches
            what is produced from the cognitive process behind it; this tool
            keeps them connected. At the moment of finalization, the writer
            signs a small cryptographic receipt. What gets verified here is
            the receipt — never a guess about the prose itself.
          </QA>
          <QA q="Does this work by surveillance?">
            No keystroke logging. No monitoring. The original text is not
            stored anywhere — only its mathematical fingerprint. We do not
            know what you wrote, and we can still tell whether a single
            character was changed. The text you just pasted into this page
            is not sent to any server; the check happens entirely in your
            browser.
          </QA>
          <p style={readMoreStyle}>
            <Link href="/about" style={readMoreLinkStyle}>
              Learn more about how this actually works →
            </Link>
          </p>
        </div>
      </section>

      <section style={detailSectionStyle}>
        <h2 style={subheadingStyle}>Try it yourself</h2>
        <p style={qaAnswerStyle}>
          This same site is also where AI-free compositions are made. To
          write your own,{" "}
          <Link href="/" style={linkStyle}>
            visit the composition page →
          </Link>
        </p>
      </section>

      <section style={detailSectionStyle}>
        <h2 style={subheadingStyle}>How can I verify this independently?</h2>
        <p style={mutedStyle}>
          These four pieces are sufficient to verify the signature without
          trusting this site. Any standard Ed25519 verifier can confirm the
          signature using just the public key, the signed payload, and the
          signature. The source code is at{" "}
          <a
            href="https://github.com/cogintegritylab/interaction-layer"
            target="_blank"
            rel="noreferrer"
            style={linkStyle}
          >
            github.com/cogintegritylab/interaction-layer
          </a>
          .
        </p>
        <ProofField label="Public key (Ed25519, SPKI, base64)" value={PUBLIC_KEY_BASE64} />
        <ProofField label="Signed payload (canonical JSON)" value={receiptCanonical} />
        <ProofField label="Signature (base64)" value={signature} />
        <ProofField label="This verify page" value={verifyUrl} />
      </section>

      <p style={aboutLinkStyle}>
        <Link href="/about" style={aboutLinkAnchorStyle}>
          About this site, the protocol, and the trust model
        </Link>
      </p>
    </main>
  );
}

const aboutLinkStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.85rem",
  color: "#6b6b6b",
};

const aboutLinkAnchorStyle: React.CSSProperties = {
  color: "#6b6b6b",
  textDecoration: "underline",
};

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === "idle") {
    return (
      <div style={bannerStyle("neutral")}>
        Waiting for paste — verification result will appear as soon as you
        paste.
      </div>
    );
  }
  if (status.kind === "checking") {
    return <div style={bannerStyle("neutral")}>Checking…</div>;
  }
  if (status.kind === "valid") {
    return (
      <div style={bannerStyle("green")}>
        <strong>Valid.</strong> The pasted text matches the signed receipt, and
        the signature verifies.
      </div>
    );
  }
  if (status.kind === "invalid_hash") {
    return (
      <div style={bannerStyle("red")}>
        <strong>Invalid.</strong> The text you pasted does not match the
        receipt. Either the text has been edited since signing, or the wrong
        section of the message was pasted. Try pasting only the text that
        appears above the verify line in the original message.
      </div>
    );
  }
  if (status.kind === "invalid_signature") {
    return (
      <div style={bannerStyle("red")}>
        <strong>Invalid.</strong> The signature does not verify against the
        public key shown below. The receipt may have been tampered with after
        being issued.
      </div>
    );
  }
  return (
    <div style={bannerStyle("red")}>
      <strong>Error.</strong> {status.message}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  breakAll,
}: {
  label: string;
  value: string;
  mono?: boolean;
  breakAll?: boolean;
}) {
  return (
    <>
      <dt style={dtStyle}>{label}</dt>
      <dd
        style={{
          ...ddStyle,
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
          wordBreak: breakAll ? "break-all" : "normal",
        }}
      >
        {value}
      </dd>
    </>
  );
}

function ProofField({ label, value }: { label: string; value: string }) {
  return (
    <div style={proofFieldStyle}>
      <div style={proofLabelStyle}>{label}</div>
      <div style={proofValueStyle}>{value}</div>
    </div>
  );
}

function QA({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div style={qaItemStyle}>
      <div style={qaQuestionStyle}>{q}</div>
      <div style={qaAnswerStyle}>{children}</div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1.5rem",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const kickerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6b6b6b",
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 600,
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "#6b6b6b",
  fontSize: "0.9rem",
};

const subheadingStyle: React.CSSProperties = {
  margin: "0 0 0.75rem 0",
  fontSize: "0.85rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b6b6b",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "30vh",
  padding: "1rem",
  fontFamily: "inherit",
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#1a1a1a",
  background: "#fff",
  border: "1px solid #d4d4d4",
  borderRadius: 6,
  resize: "vertical",
  outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const detailSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const dlStyle: React.CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  rowGap: "0.4rem",
  columnGap: "1rem",
};

const dtStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.85rem",
  color: "#6b6b6b",
};

const ddStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  color: "#1a1a1a",
};

const qaStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.9rem",
};

const qaItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
};

const qaQuestionStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#1a1a1a",
};

const qaAnswerStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  lineHeight: 1.6,
  color: "#333",
};

const linkStyle: React.CSSProperties = {
  color: "#0d4a8a",
  textDecoration: "underline",
};

const readMoreStyle: React.CSSProperties = {
  margin: "0.5rem 0 0",
  fontSize: "0.95rem",
  fontWeight: 500,
};

const readMoreLinkStyle: React.CSSProperties = {
  color: "#0d4a8a",
  textDecoration: "underline",
};

const proofFieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3rem",
  padding: "0.75rem 0",
  borderBottom: "1px solid #ececec",
};

const proofLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#6b6b6b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const proofValueStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: "0.8rem",
  lineHeight: 1.4,
  color: "#1a1a1a",
  wordBreak: "break-all",
  whiteSpace: "pre-wrap",
};

function bannerStyle(tone: "green" | "red" | "neutral"): React.CSSProperties {
  const palette =
    tone === "green"
      ? { bg: "#eafaf0", border: "#b8e6c8", fg: "#1f6a3d" }
      : tone === "red"
      ? { bg: "#fdecec", border: "#f5c4c4", fg: "#7a1a1a" }
      : { bg: "#f6f6f6", border: "#e0e0e0", fg: "#6b6b6b" };
  return {
    padding: "0.75rem 1rem",
    fontSize: "0.95rem",
    color: palette.fg,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
  };
}
