import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function scrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, SCRYPT_OPTIONS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * Password hashing for the local SQLite (development/demo) auth provider.
 * Production authentication is Supabase Auth, which stores and verifies
 * passwords itself; Anoneye never sees them in that mode.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
