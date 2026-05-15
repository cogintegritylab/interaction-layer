# interaction-layer

A prototype of trust infrastructure for AI-mediated communication, by Cognitive Integrity Lab.

The first mode is `ai_free`: a paste-blocked composition page that produces a cryptographically signed receipt certifying the text was composed under declared channel conditions. Anyone can verify a receipt independently of the issuing site, using only the public key and any standard Ed25519 verifier.

**Live site:** https://interaction.cognitio.fyi

The aim is not AI detection. The aim is to certify process and channel conditions — to let signed receipts replace "trust me" claims about how a piece of text was produced.

Status: early prototype. v1.0 has launched; active work toward v1.1 (hash-only storage, paste-to-verify, multi-issuer receipt format) is ongoing.
