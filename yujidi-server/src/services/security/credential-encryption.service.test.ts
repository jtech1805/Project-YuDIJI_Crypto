import assert from "node:assert/strict";
import test from "node:test";

import { CredentialEncryptionService } from "./credential-encryption.service.js";

test("CredentialEncryptionService encrypts and decrypts a secret", () => {
  const service = new CredentialEncryptionService("test-encryption-key");
  const encrypted = service.encryptSecret("super-secret");

  assert.notEqual(encrypted, "super-secret");
  assert.match(encrypted, /^v1:/);
  assert.equal(service.decryptSecret(encrypted), "super-secret");
});

test("CredentialEncryptionService handles empty values", () => {
  const service = new CredentialEncryptionService("test-encryption-key");

  assert.equal(service.encryptSecret(""), "");
  assert.equal(service.decryptSecret(""), "");
});

test("CredentialEncryptionService rejects invalid ciphertext", () => {
  const service = new CredentialEncryptionService("test-encryption-key");

  assert.throws(() => {
    service.decryptSecret("not-valid");
  }, /Invalid encrypted secret format/);
});

test("CredentialEncryptionService requires an encryption key", () => {
  assert.throws(() => {
    new CredentialEncryptionService("");
  }, /BROKER_CREDENTIAL_ENCRYPTION_KEY is required/);
});
