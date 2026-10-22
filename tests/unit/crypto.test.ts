import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto/tokens";
import { hashPassword, verifyPassword } from "@/lib/crypto/password";

describe("token encryption", () => {
  it("round-trips a secret without storing plaintext", () => {
    const secret = "EAAG-test-token-1234567890";
    const ciphertext = encryptToken(secret);
    expect(ciphertext).not.toContain(secret);
    expect(ciphertext.startsWith("v1.")).toBe(true);
    expect(ciphertext.split(".")).toHaveLength(4);
    expect(decryptToken(ciphertext)).toBe(secret);
  });

  it("uses a fresh IV for every encryption", () => {
    const first = encryptToken("same-value");
    const second = encryptToken("same-value");
    expect(first).not.toBe(second);
    expect(decryptToken(first)).toBe(decryptToken(second));
  });

  it("rejects tampered ciphertext and malformed payloads", () => {
    const ciphertext = encryptToken("secret");
    const parts = ciphertext.split(".");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("tampered").toString("base64")].join(".");
    expect(() => decryptToken(tampered)).toThrow();
    expect(() => decryptToken("nonsense")).toThrow(/malformed/i);
    expect(() => decryptToken("v2.a.b.c")).toThrow(/malformed/i);
  });
});

describe("password hashing", () => {
  it("stores a salted scrypt hash that verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces different hashes for the same password", async () => {
    const first = await hashPassword("repeatable");
    const second = await hashPassword("repeatable");
    expect(first).not.toBe(second);
    expect(await verifyPassword("repeatable", first)).toBe(true);
    expect(await verifyPassword("repeatable", second)).toBe(true);
  });

  it("fails closed on corrupt hashes", async () => {
    expect(await verifyPassword("anything", "scrypt$bad")).toBe(false);
    expect(await verifyPassword("anything", "plaintext")).toBe(false);
  });
});
