/**
 * Wave 10: AES-256-GCM secret encryption for credentials at rest.
 *
 * Single responsibility: round-trip a plaintext credential through
 * symmetric encryption so it can be persisted to Postgres without
 * appearing in logs, backups, or replicated reads as plaintext.
 *
 * Threat model:
 *   - Defender against a leaked DB snapshot. If an attacker reads the
 *     bytes of `McpServerConnection.encryptedCredentials` or
 *     `ExternalDataSource.encryptedCredentials`, they cannot derive
 *     the PAT / API key / bearer token without ALSO obtaining the
 *     `SECRETS_ENCRYPTION_KEY` env var.
 *   - NOT a defender against a compromised running server. A live
 *     attacker who can read process env vars can decrypt anything.
 *   - NOT a defender against a malicious admin. Same.
 *
 * Algorithm: AES-256-GCM with a 12-byte IV (NIST-recommended for GCM),
 * 32-byte key, 16-byte auth tag. Each ciphertext is salted with a
 * fresh random IV so identical plaintexts produce different ciphertext.
 *
 * Envelope format (base64-encoded):
 *   <iv-12-bytes>.<ciphertext>.<tag-16-bytes>
 * The dot delimiter is safe in base64 because base64 alphabet is
 * [A-Za-z0-9+/=] and never contains a dot.
 *
 * Key source: SECRETS_ENCRYPTION_KEY env var. MUST be:
 *   - 64 hex chars (32 bytes after hex decode)
 *   - Distinct from AUTH_JWT_SECRET, CRDT_JWT_SECRET, CRDT_PERSIST_SECRET
 *
 * Both invariants are enforced at module load time so misconfiguration
 * fails fast.
 *
 * Important: this module NEVER logs the plaintext, the key, the IV,
 * the tag, or the ciphertext. Errors are sanitized before throwing.
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX_LENGTH = 64; // 32 bytes
const KEY_BYTE_LENGTH = 32;
const IV_BYTE_LENGTH = 12; // NIST-recommended for GCM
const TAG_BYTE_LENGTH = 16;

// ---------------------------------------------------------------------------
// Module-load invariants.
// ---------------------------------------------------------------------------

const SECRETS_KEY_HEX = process.env.SECRETS_ENCRYPTION_KEY;

if (!SECRETS_KEY_HEX) {
  throw new Error(
    "[secrets-service] SECRETS_ENCRYPTION_KEY is not set. " +
      "Generate one with: openssl rand -hex 32",
  );
}

if (SECRETS_KEY_HEX.length !== KEY_HEX_LENGTH) {
  throw new Error(
    `[secrets-service] SECRETS_ENCRYPTION_KEY must be exactly ${KEY_HEX_LENGTH} hex characters ` +
      `(${KEY_BYTE_LENGTH} bytes). Got ${SECRETS_KEY_HEX.length} characters. ` +
      "Generate one with: openssl rand -hex 32",
  );
}

// Decode + validate hex
let SECRETS_KEY: Buffer;
try {
  SECRETS_KEY = Buffer.from(SECRETS_KEY_HEX, "hex");
} catch {
  throw new Error(
    "[secrets-service] SECRETS_ENCRYPTION_KEY contains non-hex characters.",
  );
}
if (SECRETS_KEY.length !== KEY_BYTE_LENGTH) {
  throw new Error(
    `[secrets-service] SECRETS_ENCRYPTION_KEY decoded to ${SECRETS_KEY.length} bytes; expected ${KEY_BYTE_LENGTH}.`,
  );
}

// Distinctness check: SECRETS_ENCRYPTION_KEY MUST differ from the three
// other secrets. Reuse of the same string across roles cascades a
// compromise of one to the others.
{
  const pairs: Array<[string, string | undefined]> = [
    ["AUTH_JWT_SECRET", process.env.AUTH_JWT_SECRET],
    ["CRDT_JWT_SECRET", process.env.CRDT_JWT_SECRET],
    ["CRDT_PERSIST_SECRET", process.env.CRDT_PERSIST_SECRET],
  ];
  for (const [otherName, otherValue] of pairs) {
    if (otherValue && otherValue === SECRETS_KEY_HEX) {
      throw new Error(
        `[secrets-service] SECRETS_ENCRYPTION_KEY and ${otherName} share the same value. ` +
          "Each secret MUST be a distinct string so compromise of one does not " +
          "cascade to the others. Generate fresh values with: openssl rand -hex 32",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext credential. Returns an envelope of the form
 * `<iv-base64>.<ciphertext-base64>.<tag-base64>` safe to persist as
 * a UTF-8 text column.
 *
 * Pure function (modulo the random IV). Never logs the plaintext.
 */
export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("[secrets-service] plaintext must be a non-empty string");
  }

  const iv = crypto.randomBytes(IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRETS_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(".");
}

/**
 * Decrypt an envelope produced by `encryptSecret`. Throws a sanitized
 * error if the envelope is malformed, the IV/tag are missing, or the
 * auth tag fails (tampering or wrong key).
 *
 * The thrown error message never includes the ciphertext or plaintext.
 */
export function decryptSecret(envelope: string): string {
  if (typeof envelope !== "string" || envelope.length === 0) {
    throw new Error("[secrets-service] envelope must be a non-empty string");
  }
  const parts = envelope.split(".");
  if (parts.length !== 3) {
    throw new Error(
      "[secrets-service] envelope has wrong shape (expected iv.ct.tag)",
    );
  }
  const [ivB64, ctB64, tagB64] = parts;
  let iv: Buffer;
  let ct: Buffer;
  let tag: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    ct = Buffer.from(ctB64, "base64");
    tag = Buffer.from(tagB64, "base64");
  } catch {
    throw new Error("[secrets-service] envelope contains malformed base64");
  }
  if (iv.length !== IV_BYTE_LENGTH) {
    throw new Error(
      `[secrets-service] envelope iv has wrong length (expected ${IV_BYTE_LENGTH})`,
    );
  }
  if (tag.length !== TAG_BYTE_LENGTH) {
    throw new Error(
      `[secrets-service] envelope tag has wrong length (expected ${TAG_BYTE_LENGTH})`,
    );
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, SECRETS_KEY, iv);
  decipher.setAuthTag(tag);
  try {
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // AES-GCM auth-tag failure means ciphertext was tampered with OR
    // the wrong key is in use. Either way the error must not leak any
    // bytes from the envelope.
    throw new Error(
      "[secrets-service] decryption failed (tampered ciphertext or wrong key)",
    );
  }
}

/**
 * Safe utility: returns true if the envelope can be decrypted with the
 * current key. Used by the `mcp-servers/[id]/test` route to fail fast
 * on a malformed stored credential.
 */
export function canDecryptSecret(envelope: string): boolean {
  try {
    decryptSecret(envelope);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convenience: re-export the key length constants so callers can
 * validate inputs without re-importing the algorithm parameters.
 */
export const SECRETS_PARAMS = {
  algorithm: ALGORITHM,
  keyHexLength: KEY_HEX_LENGTH,
  ivByteLength: IV_BYTE_LENGTH,
  tagByteLength: TAG_BYTE_LENGTH,
} as const;
