# interaction-layer

A prototype of trust infrastructure for AI-mediated communication, by Cognitive Integrity Lab.

The first mode is `ai_free`: a paste-blocked composition page that produces a cryptographically signed receipt certifying the text was composed under declared process conditions. Anyone can verify a receipt independently of the issuing site, using only the public key and any standard Ed25519 verifier.

**Live site:** https://interaction.cognitio.fyi

The aim is not AI detection. The aim is to certify process conditions — to let signed receipts replace "trust me" claims about how a piece of text was produced.

## Status

- **v1.1 shipped.** Hash-only storage (the server never stores writing content), paste-to-verify, multi-issuer receipt format, public source code and verification key, /about with the full rationale.
- **Phase 2a in progress.** Adding the `.cogdoc` local-file model with signed checkpoint chains — portable drafts across devices without server-side draft storage. Bumps the protocol to v2.
  - **2a.1** ✅ signing endpoint (`/api/checkpoint`) with session + CSRF + origin + per-session rate limit; server-side checkpoint signing using Ed25519.
  - **2a.2** ✅ "Save to Device" button writing `.cogdoc` files.
  - **2a.3** ✅ "Open Draft" with local verification of the checkpoint chain.
  - **2a.4** *(current):* Continuation chain (subsequent saves chain to previous; broken or finalized files start a fresh doc_id).
  - **2a.5:** Polish + integration with Finalize + UI for chain status.

## Protocol specification

The complete technical specification — file format, canonicalization rules, signing endpoint contract, verification algorithm, UI states, and a five-level assurance framework — is at [SPEC.md](SPEC.md).
