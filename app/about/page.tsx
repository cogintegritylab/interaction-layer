import Link from "next/link";
import { PUBLIC_KEY_BASE64, KEY_ID } from "@/lib/public-key";

export const metadata = {
  title: "About — Cognitive Integrity Lab interaction layer",
};

export default function AboutPage() {
  return (
    <main style={pageStyle}>
      <p style={kickerStyle}>
        <a
          href="https://sites.temple.edu/cilab/"
          style={kickerLinkStyle}
        >
          Cognitive Integrity Lab
        </a>{" "}
        · interaction layer
      </p>
      <h1 style={h1Style}>About this prototype</h1>

      <p style={paragraphStyle}>
        This site is an early prototype of a different way of thinking about
        trust in AI-mediated communication. The core idea: rather than trying
        to detect AI-generated text after the fact — guessing from word
        patterns, em-dashes, or polish — we certify the process by which a
        piece of writing was produced.
      </p>

      <p style={paragraphStyle}>
        Each composition finalized here produces a cryptographically signed
        receipt that records what mode the writer declared (here:{" "}
        <code style={codeStyle}>ai_free</code>), when the text was finalized,
        and a one-way fingerprint of the exact text. The receipt is publicly
        verifiable, but the writing itself is never stored on this server.
      </p>

      <h2 style={h2Style}>The cryptographic principle</h2>
      <p style={paragraphStyle}>
        Earlier cryptographic systems — like the Nazi Enigma — depended on
        shared secrets. Once those secrets were recovered, as they famously
        were by Turing&rsquo;s team at Bletchley Park, the system&rsquo;s
        communications could be read.
      </p>
      <p style={paragraphStyle}>
        Modern public-key cryptography changed the game. Authenticity can now
        be verified publicly without exposing the private key that created the
        signature. That is the principle behind HTTPS, software signing,
        banking security, and cryptocurrencies.
      </p>
      <p style={paragraphStyle}>
        We apply the same idea to AI-mediated communication: not detecting
        what &ldquo;sounds human,&rdquo; but verifying the conditions under
        which a message was produced.
      </p>

      <h2 style={h2Style}>What you know with mathematical certainty</h2>
      <p style={paragraphStyle}>
        When the verify page shows a green &ldquo;Valid&rdquo; banner, two
        things have been mathematically checked:
      </p>
      <ol style={listStyle}>
        <li style={liStyle}>
          <strong>Text integrity.</strong> The text in your hands matches,
          character for character (after small whitespace normalization), the
          text that was originally signed. Change one comma, and verification
          fails.
        </li>
        <li style={liStyle}>
          <strong>Signature authenticity.</strong> That text fingerprint,
          paired with a timestamp, was signed using the private key paired
          with the public key shown below.
        </li>
      </ol>
      <p style={paragraphStyle}>
        Both checks happen in your browser. The text you paste is not sent to
        this server or any other server. The signature can also be verified
        using any standard Ed25519 verifier outside this site, with no trust
        in this site required.
      </p>

      <h2 style={h2Style}>What you know with very high confidence</h2>
      <p style={paragraphStyle}>
        That the code running on this server matches the source code published
        in the open. The full source is at{" "}
        <a
          href="https://github.com/cogintegritylab/interaction-layer"
          style={linkStyle}
        >
          github.com/cogintegritylab/interaction-layer
        </a>
        . The hosting provider (Vercel) records the public commit SHA each
        deployment is built from; the deployment page is itself public. So
        anyone can trace any verify page back to a specific public commit.
      </p>
      <p style={paragraphStyle}>
        This is not a mathematical guarantee — it relies on Vercel as a
        trusted intermediary. A full mathematical guarantee here would
        require what is called &ldquo;reproducible builds with cryptographic
        attestations&rdquo;: a public, automated process whose build output is
        signed and matchable byte-for-byte against the public source. The
        method is well established in supply-chain security, and bringing
        this project under it is on our roadmap.
      </p>

      <h2 style={h2Style}>What this tool cannot prove</h2>
      <ul style={listStyle}>
        <li style={liStyle}>
          <strong>Authorship.</strong> The receipt does not prove who composed
          the words, only that the text passed through a tool whose paste,
          copy, and drag protections were in effect. Some input channels —
          voice dictation, accessibility tools — cannot be distinguished from
          manual typing. And no tool can determine what the writer was
          reading, thinking, or referring to as they typed. Stronger
          enforcement of composition conditions would require a verified
          client, which is on the protocol roadmap.
        </li>
        <li style={liStyle}>
          <strong>That the timestamp is independently anchored.</strong> The
          current implementation uses the issuer&rsquo;s server clock; an
          independent timestamping service (such as OpenTimestamps, which
          anchors signatures to a public ledger) would provide times
          verifiable without trusting any single party. This is on the
          roadmap.
        </li>
      </ul>

      <h2 style={h2Style}>Why we don&rsquo;t try to detect</h2>
      <p style={paragraphStyle}>
        A person can prompt a model, lightly edit the output, and pass along
        clever or misguided ideas they don&rsquo;t understand; nothing in a
        detection result reveals that. And the question remains:{" "}
        <em>was anyone home?</em>
      </p>
      <p style={paragraphStyle}>
        Detection by style also damages what it claims to protect. Em-dashes,
        semicolons, and well-formed paragraphs become evidence against the
        writer; choppy prose is rewarded, care is punished. Most stylistic
        formulas exist for reasons. The deeper cost of abandoning them is
        ceding authority over language to whoever runs the largest models
        and detectors — language stops being a distributed inheritance and
        becomes a centralized verdict on what counts as human.
      </p>
      <p style={paragraphStyle}>
        This tool does not look at your prose. Use em-dashes to your
        heart&rsquo;s content; use phrases critics have decided &ldquo;sound
        AI&rdquo;; write in whatever voice suits you — none of it is evidence
        about you. Instead of asking readers to inspect every sentence for
        signs of machine origin, the approach is to let writers commit to a
        process and let readers check the commitment with math. The writer
        offers a receipt; the reader verifies it; nobody is on trial for
        their punctuation.
      </p>

      <h2 style={h2Style}>The bigger picture</h2>
      <p style={paragraphStyle}>
        <code style={codeStyle}>ai_free</code> is one demonstration of the
        idea — and a simple one. It is not the endpoint, and it is not a
        moralistic stance against AI use. It is a proof of concept: a
        certified-process model can be public, lightweight, and independently
        verifiable. The same structure supports many other modes, each
        appropriate to different settings:
      </p>
      <ul style={listStyle}>
        <li style={liStyle}>
          <code style={codeStyle}>ai_free</code> — composed by hand, in a
          paste-blocked environment (this mode).
        </li>
        <li style={liStyle}>
          <code style={codeStyle}>cognitive_authorship_check</code> — a
          follow-up assessment in which the writer is asked to extend the
          composition, consider alternatives, or restate it in different
          terms. Not a test of understanding; a test of whether the writer
          can inhabit the work as their own. This is the mode the{" "}
          <a href="https://sites.temple.edu/cilab/" style={linkStyle}>
            Cognitive Integrity Lab
          </a>{" "}
          is currently piloting.
        </li>
        <li style={liStyle}>
          <code style={codeStyle}>socratic_mode</code> — composed with an AI
          assistant that may ask questions and offer challenges but never
          supplies substantive content.
        </li>
        <li style={liStyle}>
          <code style={codeStyle}>ai_assisted</code> — composed with declared
          AI involvement.
        </li>
        <li style={liStyle}>
          <code style={codeStyle}>translation_active</code> — passed through
          translation; original language and provider recorded.
        </li>
        <li style={liStyle}>
          <code style={codeStyle}>human_reviewed</code> — AI-produced text
          reviewed and approved by a named human.
        </li>
        <li style={liStyle}>
          <code style={codeStyle}>classroom_exam_mode</code> — produced under
          monitored exam conditions.
        </li>
        <li style={liStyle}>
          Professional modes such as{" "}
          <code style={codeStyle}>medical_diagnosis_mode</code>,{" "}
          <code style={codeStyle}>legal_brief_certified_mode</code>, or{" "}
          <code style={codeStyle}>journalism_sourced_mode</code> —
          placeholder names for what medical, legal, journalistic, and other
          professional communities might define on top of the protocol. The
          specific shape of these is for the communities to determine.
        </li>
      </ul>
      <p style={paragraphStyle}>
        The issuer can vary as well. The{" "}
        <a href="https://sites.temple.edu/cilab/" style={linkStyle}>
          Cognitive Integrity Lab
        </a>{" "}
        is the first issuer, but the format is designed to be open: in
        principle, Gmail, Outlook, Canvas, universities, journals, and
        hospitals could each issue their own signed receipts under a shared
        vocabulary. The value of the system is not that one lab signs
        everything forever; it is that anyone can issue, anyone can verify,
        and the protocol vocabulary is public.
      </p>

      <h2 style={h2Style}>Verifying independently</h2>
      <p style={paragraphStyle}>
        Every verify page shows four pieces sufficient to verify the
        signature without trusting this site:
      </p>
      <ul style={listStyle}>
        <li style={liStyle}>The public key (Ed25519 SPKI, base64).</li>
        <li style={liStyle}>
          The signed payload, as canonical JSON — the exact bytes that were
          signed.
        </li>
        <li style={liStyle}>The signature (base64).</li>
        <li style={liStyle}>The URL of the verify page itself.</li>
      </ul>
      <p style={paragraphStyle}>
        Any cryptography library or command-line tool that supports Ed25519
        can confirm the signature using just those pieces. The full source
        code shows exactly how the canonical payload is constructed.
      </p>
      <p style={paragraphStyle}>
        The current{" "}
        <a href="https://sites.temple.edu/cilab/" style={linkStyle}>
          Cognitive Integrity Lab
        </a>{" "}
        signing key, key ID <code style={codeStyle}>{KEY_ID}</code>:
      </p>
      <pre style={preStyle}>{PUBLIC_KEY_BASE64}</pre>

      <h2 style={h2Style}>Roadmap</h2>
      <p style={paragraphStyle}>
        Current development focuses on closing the limits described above.
        The protocol specification defines a framework of increasingly
        strong assurance — independent timestamping, verified clients, and
        third-party institutional audit — that we are actively working
        toward. The full framework is in §14 of the{" "}
        <a
          href="https://github.com/cogintegritylab/interaction-layer/blob/main/SPEC.md#14-assurance-levels"
          style={linkStyle}
        >
          protocol specification
        </a>
        .
      </p>

      <h2 style={h2Style}>Attribution</h2>
      <p style={paragraphStyle}>
        Built by the{" "}
        <a href="https://sites.temple.edu/cilab/" style={linkStyle}>
          Cognitive Integrity Lab
        </a>{" "}
        at Temple University. Source code and issues:{" "}
        <a
          href="https://github.com/cogintegritylab/interaction-layer"
          style={linkStyle}
        >
          github.com/cogintegritylab/interaction-layer
        </a>
        .
      </p>

      <p style={paragraphStyle}>
        <Link href="/" style={linkStyle}>
          ← Back to the composition page
        </Link>
      </p>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem 5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const kickerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.8rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6b6b6b",
};

const kickerLinkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "underline",
};

const h1Style: React.CSSProperties = {
  margin: "0 0 1rem 0",
  fontSize: "1.75rem",
  fontWeight: 600,
};

const h2Style: React.CSSProperties = {
  margin: "1.75rem 0 0.25rem",
  fontSize: "1.15rem",
  fontWeight: 600,
};

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "1rem",
  lineHeight: 1.65,
  color: "#1a1a1a",
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const liStyle: React.CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1.6,
  color: "#1a1a1a",
};

const linkStyle: React.CSSProperties = {
  color: "#0d4a8a",
  textDecoration: "underline",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: "0.92em",
  padding: "0.05em 0.3em",
  background: "#f0f0f0",
  borderRadius: 3,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: "0.85rem 1rem",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: "0.85rem",
  lineHeight: 1.5,
  color: "#1a1a1a",
  background: "#f6f6f6",
  border: "1px solid #e0e0e0",
  borderRadius: 6,
  wordBreak: "break-all",
  whiteSpace: "pre-wrap",
};
