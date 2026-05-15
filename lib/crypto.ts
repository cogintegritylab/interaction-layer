import {
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

let cachedPrivateKey: KeyObject | null = null;
let cachedPublicKey: KeyObject | null = null;

function getPrivateKey(): KeyObject {
  if (cachedPrivateKey) return cachedPrivateKey;
  const b64 = process.env.SIGNING_PRIVATE_KEY;
  if (!b64) throw new Error("SIGNING_PRIVATE_KEY is not set");
  cachedPrivateKey = createPrivateKey({
    key: Buffer.from(b64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  return cachedPrivateKey;
}

function getPublicKey(): KeyObject {
  if (cachedPublicKey) return cachedPublicKey;
  const b64 = process.env.SIGNING_PUBLIC_KEY;
  if (!b64) throw new Error("SIGNING_PUBLIC_KEY is not set");
  cachedPublicKey = createPublicKey({
    key: Buffer.from(b64, "base64"),
    format: "der",
    type: "spki",
  });
  return cachedPublicKey;
}

export function generateId(): string {
  return randomBytes(6).toString("base64url");
}

export type SignableRecord = {
  id: string;
  text: string;
  createdAt: string;
};

function canonicalPayload(record: SignableRecord): string {
  return ["v1", record.id, record.createdAt, record.text].join("\t");
}

export function signRecord(record: SignableRecord): string {
  const payload = canonicalPayload(record);
  const signature = sign(null, Buffer.from(payload, "utf8"), getPrivateKey());
  return signature.toString("base64");
}

export function verifyRecord(
  record: SignableRecord & { signature: string }
): boolean {
  const payload = canonicalPayload(record);
  return verify(
    null,
    Buffer.from(payload, "utf8"),
    getPublicKey(),
    Buffer.from(record.signature, "base64")
  );
}
