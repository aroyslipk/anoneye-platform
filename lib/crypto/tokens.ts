import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { decodeBase64Key, getEnv } from "@/lib/env";

/**
 * AES-256-GCM encryption for OAuth access tokens at rest.
 * Ciphertext format: v1.<iv-b64>.<tag-b64>.<ciphertext-b64>
 * The key lives only in server environment variables.
 */

const VERSION = "v1";

function key(): Buffer {
  const raw = getEnv().TOKEN_ENCRYPTION_KEY;
  const decoded = raw ? decodeBase64Key(raw) : null;
  if (!decoded) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not configured. Generate one with: openssl rand -base64 32",
    );
  }
  return decoded;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptToken(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored credential is malformed");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
