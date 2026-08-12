import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

export class CredentialEncryptionService {
  private readonly key: Buffer;

  public constructor(rawKey = process.env.BROKER_CREDENTIAL_ENCRYPTION_KEY) {
    if (!rawKey?.trim()) {
      throw new Error("BROKER_CREDENTIAL_ENCRYPTION_KEY is required");
    }

    this.key = this.normalizeKey(rawKey.trim());
  }

  public encryptSecret(value: string): string {
    if (value.length === 0) {
      return "";
    }

    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      ENCRYPTION_VERSION,
      iv.toString("base64"),
      authTag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":");
  }

  public decryptSecret(encryptedValue: string): string {
    if (encryptedValue.length === 0) {
      return "";
    }

    const [version, ivBase64, authTagBase64, ciphertextBase64] = encryptedValue.split(":");
    if (
      version !== ENCRYPTION_VERSION ||
      !ivBase64 ||
      !authTagBase64 ||
      !ciphertextBase64
    ) {
      throw new Error("Invalid encrypted secret format");
    }

    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const ciphertext = Buffer.from(ciphertextBase64, "base64");

    if (iv.length !== IV_LENGTH_BYTES || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new Error("Invalid encrypted secret payload");
    }

    const decipher = createDecipheriv("aes-256-gcm", this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  private normalizeKey(rawKey: string): Buffer {
    const base64Decoded = Buffer.from(rawKey, "base64");
    if (base64Decoded.length === 32) {
      return base64Decoded;
    }

    return createHash("sha256").update(rawKey).digest();
  }
}
