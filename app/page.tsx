"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import { hashText } from "@/lib/hash";

const DRAFT_KEY = "aife_draft_v1";

type FinalizedResult = { id: string; verifyUrl: string };

type SignedCheckpoint = {
  payload: Record<string, string | number>;
  signature: string;
  kid: string;
};

function generateDocId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readCsrfTokenFromCookie(): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("aife_csrf="));
  return match ? match.split("=")[1] : null;
}

export default function Home() {
  const [text, setText] = useState("");
  const [finalizedResult, setFinalizedResult] =
    useState<FinalizedResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalClipboard = useRef<string>("");
  const docIdRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setText(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || finalizedResult) return;
    localStorage.setItem(DRAFT_KEY, text);
  }, [text, hydrated, finalizedResult]);

  const handleCopy = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart !== selectionEnd) {
      internalClipboard.current = ta.value.slice(selectionStart, selectionEnd);
    }
  };

  const handleCut = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart !== selectionEnd) {
      internalClipboard.current = ta.value.slice(selectionStart, selectionEnd);
      // execCommand is deprecated but uniquely integrates with native undo for textareas.
      document.execCommand("insertText", false, "");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (internalClipboard.current) {
      document.execCommand("insertText", false, internalClipboard.current);
    }
  };

  const blockDrag = (e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  };

  const handleSaveToDevice = async () => {
    if (text.trim().length === 0 || saving || submitting) return;
    setSaving(true);
    setError(null);
    try {
      const csrf = readCsrfTokenFromCookie();
      if (!csrf) {
        throw new Error(
          "Session not initialized. Reload the page and try again."
        );
      }
      if (!docIdRef.current) {
        docIdRef.current = generateDocId();
      }
      const docId = docIdRef.current;
      const textHashHex = await hashText(text);

      const response = await fetch("/api/checkpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({
          doc_id: docId,
          mode: "ai_free",
          text_hash: textHashHex,
          prev_checkpoint_hash: "genesis",
        }),
      });

      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      const signed: SignedCheckpoint = await response.json();

      const cogdoc = {
        format_version: 2,
        doc_id: docId,
        mode: "ai_free",
        content: text,
        checkpoints: [signed],
        final_receipt: null,
      };

      const blob = new Blob([JSON.stringify(cogdoc, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docId}.cogdoc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (text.trim().length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const data: { error?: string } = await response
          .json()
          .catch(() => ({}));
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      const data: FinalizedResult = await response.json();
      setFinalizedResult(data);
      localStorage.removeItem(DRAFT_KEY);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartOver = () => {
    setText("");
    setFinalizedResult(null);
    setError(null);
    internalClipboard.current = "";
    docIdRef.current = null;
    localStorage.removeItem(DRAFT_KEY);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  if (finalizedResult) {
    const fullOutput = `${text}\n\nAI-free | ${finalizedResult.verifyUrl}`;
    return (
      <main style={pageStyle}>
        <p style={previewNoticeStyle}>
          Finalized. Select and copy the text below to paste elsewhere. The
          recipient can click the verify link to confirm the text and timestamp
          have not been altered.
        </p>
        <div style={finalizedTextStyle}>{fullOutput}</div>
        <button onClick={handleStartOver} style={secondaryButtonStyle}>
          Start a new composition
        </button>
        <p style={aboutLinkStyle}>
          <Link href="/about" style={aboutLinkAnchorStyle}>
            About this site
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={headingStyle}>Composition · ai_free mode</h1>
      <p style={mutedStyle}>
        Copy, cut, and paste work within this box, but text cannot enter from
        or leave to other apps. Your draft is saved in this browser until you
        click Finalize.
      </p>
      <p style={aboutPromptStyle}>
        <Link href="/about" style={aboutPromptAnchorStyle}>
          What is this? About the protocol and the trust model →
        </Link>
      </p>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onDrop={blockDrag}
        onDragOver={blockDrag}
        onDragStart={blockDrag}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={true}
        placeholder="Begin typing…"
        style={textareaStyle}
        disabled={submitting}
      />
      {error && <p style={errorStyle}>Error: {error}</p>}
      <div style={toolbarStyle}>
        <span style={mutedStyle}>{text.length} characters</span>
        <div style={buttonGroupStyle}>
          <button
            onClick={handleSaveToDevice}
            disabled={text.trim().length === 0 || saving || submitting}
            style={
              text.trim().length === 0 || saving || submitting
                ? { ...saveButtonStyle, ...disabledButtonStyle }
                : saveButtonStyle
            }
            title="Save a portable .cogdoc file to your device"
          >
            {saving ? "Saving…" : "Save to Device"}
          </button>
          <button
            onClick={handleFinalize}
            disabled={text.trim().length === 0 || submitting || saving}
            style={
              text.trim().length === 0 || submitting || saving
                ? { ...primaryButtonStyle, ...disabledButtonStyle }
                : primaryButtonStyle
            }
          >
            {submitting ? "Signing…" : "Finalize"}
          </button>
        </div>
      </div>
      <p style={aboutLinkStyle}>
        <Link href="/about" style={aboutLinkAnchorStyle}>
          About this site
        </Link>
      </p>
    </main>
  );
}

const aboutLinkStyle: React.CSSProperties = {
  margin: "1rem 0 0",
  fontSize: "0.85rem",
  color: "#6b6b6b",
};

const aboutLinkAnchorStyle: React.CSSProperties = {
  color: "#6b6b6b",
  textDecoration: "underline",
};

const aboutPromptStyle: React.CSSProperties = {
  margin: "0 0 0.25rem",
  fontSize: "0.95rem",
};

const aboutPromptAnchorStyle: React.CSSProperties = {
  color: "#0d4a8a",
  textDecoration: "underline",
  fontWeight: 500,
};

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
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

const previewNoticeStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  color: "#999",
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  padding: "0.6rem 0.8rem",
  fontSize: "0.9rem",
  color: "#7a1a1a",
  background: "#fdecec",
  border: "1px solid #f5c4c4",
  borderRadius: 6,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "60vh",
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

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
};

const buttonGroupStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const saveButtonStyle: React.CSSProperties = {
  padding: "0.6rem 1rem",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  color: "#1a1a1a",
  background: "transparent",
  border: "1px solid #c4c4c4",
  borderRadius: 6,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "0.6rem 1.2rem",
  fontSize: "1rem",
  fontFamily: "inherit",
  color: "#fff",
  background: "#1a1a1a",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  opacity: 0.4,
  cursor: "not-allowed",
};

const secondaryButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  fontFamily: "inherit",
  color: "#1a1a1a",
  background: "transparent",
  border: "1px solid #d4d4d4",
  borderRadius: 6,
  cursor: "pointer",
};

const finalizedTextStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
  fontFamily: "inherit",
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#1a1a1a",
};
