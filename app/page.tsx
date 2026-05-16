"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import { hashText, sha256Hex } from "@/lib/hash";
import { canonicalReceiptJSON } from "@/lib/canonical";
import {
  verifyCogdoc,
  type CogdocStatus,
  type SignedCheckpoint,
} from "@/lib/cogdoc";

const DRAFT_KEY = "aife_draft_v1";

type FinalizedResult = { id: string; verifyUrl: string };

type LoadedDraft = {
  status: CogdocStatus;
  reason: string | null;
  checkpointCount: number;
  finalized: boolean;
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

// Build a human-scannable filename: 2026-05-15-first-few-words.cogdoc.
// Strips punctuation/symbols, keeps letters and digits (including non-ASCII
// scripts), keeps the first six words, falls back to a date-only filename
// if no usable slug can be made.
function generateFilename(text: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `${yyyy}-${mm}-${dd}`;

  const slug = text
    .slice(0, 80)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `${datePrefix}-${slug}.cogdoc` : `${datePrefix}.cogdoc`;
}

// SHA-256 hex of the canonical payload bytes of the last checkpoint in a
// chain. Used to build the next checkpoint's prev_checkpoint_hash. Returns
// the literal "genesis" string for an empty chain.
async function lastCheckpointCanonicalHash(
  checkpoints: SignedCheckpoint[]
): Promise<string> {
  if (checkpoints.length === 0) return "genesis";
  const last = checkpoints[checkpoints.length - 1];
  const canonical = canonicalReceiptJSON(
    last.payload as unknown as Record<string, string | number>
  );
  return sha256Hex(canonical);
}

export default function Home() {
  const [text, setText] = useState("");
  const [finalizedResult, setFinalizedResult] =
    useState<FinalizedResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedDraft, setLoadedDraft] = useState<LoadedDraft | null>(null);
  const [modifiedSinceLoad, setModifiedSinceLoad] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const internalClipboard = useRef<string>("");
  const docIdRef = useRef<string | null>(null);
  const loadedCheckpointsRef = useRef<SignedCheckpoint[]>([]);
  const loadedFinalReceiptRef = useRef<SignedCheckpoint | null>(null);

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

  const handleOpenDraft = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // Allow re-selecting the same file later.
    if (!file) return;

    setError(null);
    setLoadedDraft(null);
    setModifiedSinceLoad(false);

    try {
      const rawJson = await file.text();
      const result = await verifyCogdoc(rawJson);

      if (result.status === "invalid" || result.cogdoc === null) {
        setError(
          `Could not open the file: ${result.reason || "unknown error"}.`
        );
        return;
      }

      const { cogdoc } = result;
      setText(cogdoc.content);
      docIdRef.current = cogdoc.doc_id;
      loadedCheckpointsRef.current = cogdoc.checkpoints;
      loadedFinalReceiptRef.current = cogdoc.final_receipt;
      setLoadedDraft({
        status: result.status,
        reason: result.reason,
        checkpointCount:
          cogdoc.checkpoints.length + (cogdoc.final_receipt ? 1 : 0),
        finalized: cogdoc.final_receipt !== null,
      });
      setFinalizedResult(null);
    } catch (err) {
      setError(
        `Failed to read file: ${
          err instanceof Error ? err.message : "unknown error"
        }.`
      );
    }
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

      // Decide whether this save extends the existing chain or starts a
      // fresh one. A broken or already-finalized chain cannot be extended:
      // per SPEC.md §10, regaining a certified state requires a new doc_id.
      const chainBroken = loadedDraft?.status === "broken";
      const wasFinalized = loadedFinalReceiptRef.current !== null;
      const continueChain =
        !chainBroken &&
        !wasFinalized &&
        loadedCheckpointsRef.current.length > 0;

      let docId: string;
      let prevHash: string;

      if (continueChain) {
        docId = docIdRef.current as string;
        prevHash = await lastCheckpointCanonicalHash(
          loadedCheckpointsRef.current
        );
      } else {
        // Fresh chain: either nothing was loaded, or the chain is broken /
        // finalized. In the latter two cases, generate a new doc_id and
        // abandon the previous chain in memory.
        if (chainBroken || wasFinalized || !docIdRef.current) {
          docIdRef.current = generateDocId();
          loadedCheckpointsRef.current = [];
          loadedFinalReceiptRef.current = null;
        }
        docId = docIdRef.current;
        prevHash = "genesis";
      }

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
          prev_checkpoint_hash: prevHash,
        }),
      });

      if (!response.ok) {
        const data: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server returned ${response.status}`);
      }
      const signed: SignedCheckpoint = await response.json();

      // Extend the in-memory chain.
      loadedCheckpointsRef.current = [...loadedCheckpointsRef.current, signed];

      const cogdoc = {
        format_version: 2,
        doc_id: docId,
        mode: "ai_free",
        content: text,
        checkpoints: loadedCheckpointsRef.current,
        final_receipt: null,
      };

      const blob = new Blob([JSON.stringify(cogdoc, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = generateFilename(text);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Reflect the new chain state in the banner: just-saved is always
      // valid, and the checkpoint count is the in-memory chain length.
      setLoadedDraft({
        status: "valid",
        reason: null,
        checkpointCount: loadedCheckpointsRef.current.length,
        finalized: false,
      });
      setModifiedSinceLoad(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (text.trim().length === 0 || submitting) return;
    if (loadedDraft?.status === "broken") return;
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
    setLoadedDraft(null);
    setModifiedSinceLoad(false);
    setCopied(false);
    internalClipboard.current = "";
    docIdRef.current = null;
    loadedCheckpointsRef.current = [];
    loadedFinalReceiptRef.current = null;
    localStorage.removeItem(DRAFT_KEY);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleCopyOutput = async () => {
    if (!finalizedResult) return;
    const output = `${text}\n\nAI-free | ${finalizedResult.verifyUrl}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      // Fall through to manual-selection fallback.
    }
    setError(
      "Could not copy automatically. Select the text and signature below by hand and copy them."
    );
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (loadedDraft && !modifiedSinceLoad) {
      setModifiedSinceLoad(true);
    }
  };

  if (finalizedResult) {
    return (
      <main style={pageStyle}>
        <p style={previewNoticeStyle}>
          Finalized. Click the button below to copy the text and signature
          together. The recipient can click the verify link to confirm the
          text and timestamp have not been altered.
        </p>
        <button onClick={handleCopyOutput} style={primaryButtonStyle}>
          {copied ? "✓ Copied" : "Copy text + signature"}
        </button>
        <div style={finalizedTextStyle}>{text}</div>
        <div style={finalizedTextStyle}>
          AI-free | {finalizedResult.verifyUrl}
        </div>
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
        click Finalize. To continue later or on another device, click Save
        for Later — it writes a portable signed copy you can reopen here.
      </p>
      <p style={aboutPromptStyle}>
        <Link href="/about" style={aboutPromptAnchorStyle}>
          What is this? About the protocol and the trust model →
        </Link>
      </p>
      {loadedDraft && (
        <DraftStatusBanner
          state={loadedDraft}
          modified={modifiedSinceLoad}
          onStartOver={handleStartOver}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".cogdoc,application/json"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
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
            onClick={handleOpenDraft}
            disabled={submitting || saving}
            style={
              submitting || saving
                ? { ...saveButtonStyle, ...disabledButtonStyle }
                : saveButtonStyle
            }
            title="Open a previously saved .cogdoc draft"
          >
            Open Draft
          </button>
          <button
            onClick={handleSaveToDevice}
            disabled={
              text.trim().length === 0 ||
              saving ||
              submitting ||
              loadedDraft?.status === "broken" ||
              loadedDraft?.finalized === true
            }
            style={
              text.trim().length === 0 ||
              saving ||
              submitting ||
              loadedDraft?.status === "broken" ||
              loadedDraft?.finalized === true
                ? { ...saveButtonStyle, ...disabledButtonStyle }
                : saveButtonStyle
            }
            title={
              loadedDraft?.status === "broken"
                ? "Saving is disabled while the chain is broken. Use the banner above to clear and start a new composition."
                : loadedDraft?.finalized
                  ? "This composition is finalized and cannot be re-saved. Start a new composition instead."
                  : "Save a portable, signed .cogdoc file you can reopen later or on another device"
            }
          >
            {saving ? "Saving…" : "Save for Later"}
          </button>
          <button
            onClick={handleFinalize}
            disabled={
              text.trim().length === 0 ||
              submitting ||
              saving ||
              loadedDraft?.status === "broken" ||
              loadedDraft?.finalized === true
            }
            style={
              text.trim().length === 0 ||
              submitting ||
              saving ||
              loadedDraft?.status === "broken" ||
              loadedDraft?.finalized === true
                ? { ...primaryButtonStyle, ...disabledButtonStyle }
                : primaryButtonStyle
            }
            title={
              loadedDraft?.status === "broken"
                ? "Finalize is disabled while the chain is broken. Use the banner above to clear and start a new composition."
                : loadedDraft?.finalized
                  ? "This composition is already finalized."
                  : undefined
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

function DraftStatusBanner({
  state,
  modified,
  onStartOver,
}: {
  state: LoadedDraft;
  modified: boolean;
  onStartOver: () => void;
}) {
  // Finalized takes priority: a sealed composition cannot be re-certified
  // and edits to its content do not produce a meaningful "modified" state.
  if (state.finalized) {
    return (
      <div style={statusBannerStyle("green")}>
        <div>
          <strong>Finalized.</strong> This composition is sealed —{" "}
          {state.checkpointCount} signed{" "}
          {state.checkpointCount === 1 ? "entry" : "entries"} including the
          final receipt. Save for Later and Finalize are disabled. To
          begin a new composition, use the button below.
        </div>
        <div style={{ marginTop: "0.6rem" }}>
          <button onClick={onStartOver} style={bannerButtonGreenStyle}>
            Start a new composition
          </button>
        </div>
      </div>
    );
  }
  // Broken trumps everything else: a broken chain cannot be re-certified
  // by saving the current text. The user must start a new composition and
  // re-enter the content. Save and Finalize are disabled in this state.
  if (state.status === "broken") {
    return (
      <div style={statusBannerStyle("red")}>
        <div>
          <strong>Certification broken.</strong> The text in this file does
          not match its original signature. Save for Later and Finalize
          are disabled. To certify text again, clear the editor and
          re-enter the content by hand.
        </div>
        <div style={{ marginTop: "0.6rem" }}>
          <button onClick={onStartOver} style={bannerButtonStyle}>
            Clear and start a new composition
          </button>
        </div>
      </div>
    );
  }
  if (modified) {
    return (
      <div style={statusBannerStyle("neutral")}>
        <strong>Modified since last checkpoint.</strong> Click Save for
        Later to certify the current text.
      </div>
    );
  }
  if (state.status === "valid") {
    return (
      <div style={statusBannerStyle("green")}>
        <strong>Valid certified draft.</strong>{" "}
        {state.checkpointCount === 1
          ? "1 signed checkpoint."
          : `${state.checkpointCount} signed checkpoints.`}{" "}
        The current text matches the latest signature.
      </div>
    );
  }
  if (state.status === "no_checkpoint_yet") {
    return (
      <div style={statusBannerStyle("neutral")}>
        <strong>Draft loaded.</strong> No checkpoints yet. Click Save for
        Later to certify.
      </div>
    );
  }
  return null;
}

const bannerButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.85rem",
  fontSize: "0.9rem",
  fontFamily: "inherit",
  color: "#7a1a1a",
  background: "transparent",
  border: "1px solid #c98080",
  borderRadius: 6,
  cursor: "pointer",
};

const bannerButtonGreenStyle: React.CSSProperties = {
  padding: "0.4rem 0.85rem",
  fontSize: "0.9rem",
  fontFamily: "inherit",
  color: "#1f6a3d",
  background: "transparent",
  border: "1px solid #95cda9",
  borderRadius: 6,
  cursor: "pointer",
};

function statusBannerStyle(
  tone: "green" | "red" | "neutral"
): React.CSSProperties {
  const palette =
    tone === "green"
      ? { bg: "#eafaf0", border: "#b8e6c8", fg: "#1f6a3d" }
      : tone === "red"
      ? { bg: "#fdecec", border: "#f5c4c4", fg: "#7a1a1a" }
      : { bg: "#f6f6f6", border: "#e0e0e0", fg: "#6b6b6b" };
  return {
    padding: "0.6rem 0.9rem",
    fontSize: "0.9rem",
    color: palette.fg,
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
  };
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
