import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env.local");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privateKeyBase64 = privateKey
  .export({ format: "der", type: "pkcs8" })
  .toString("base64");
const publicKeyBase64 = publicKey
  .export({ format: "der", type: "spki" })
  .toString("base64");

const newLines = [
  `SIGNING_PRIVATE_KEY=${privateKeyBase64}`,
  `SIGNING_PUBLIC_KEY=${publicKeyBase64}`,
];

let existingContent = "";
if (existsSync(envPath)) {
  existingContent = readFileSync(envPath, "utf8");
  if (existingContent.includes("SIGNING_PRIVATE_KEY=")) {
    console.error("");
    console.error("ABORTED: signing keys already exist in .env.local.");
    console.error(
      "Regenerating would invalidate every existing signature on the verify page."
    );
    console.error(
      "If you really want to regenerate, manually remove the SIGNING_PRIVATE_KEY"
    );
    console.error("and SIGNING_PUBLIC_KEY lines from .env.local, then re-run.");
    console.error("");
    process.exit(1);
  }
}

const separator =
  existingContent.length === 0 || existingContent.endsWith("\n") ? "" : "\n";
const newContent = existingContent + separator + newLines.join("\n") + "\n";
writeFileSync(envPath, newContent, { mode: 0o600 });

console.log("");
console.log("Signing keys generated and saved to .env.local");
console.log(
  "(The actual key values are intentionally not printed here. Open .env.local in VS Code when you need them.)"
);
console.log("");
