'use strict';
const crypto = require('crypto');

// Unlike the other services in this folder (sms/storage/aiChat), the key is
// read and validated eagerly at module load, not lazily on first use. A
// module whose only job is "don't lose device credentials" should crash the
// server at boot on a missing/malformed key, not silently produce garbage
// ciphertext or fail the first time an admin tries to save real camera
// credentials in production.
const KEY_HEX = process.env.DAHUA_CREDENTIALS_KEY;
if (!KEY_HEX || !/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  throw new Error('DAHUA_CREDENTIALS_KEY must be a 64-character hex string (32 bytes) — see server/.env.example');
}
const KEY = Buffer.from(KEY_HEX, 'hex');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encryptCredentials(plainObj) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plainObj), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: ciphertext.toString('hex'),
    encryptedAt: new Date().toISOString(),
  };
}

function decryptCredentials(record) {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(record.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(record.authTag, 'hex'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'hex')), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    throw new Error('Credential decryption failed — ciphertext or key mismatch');
  }
}

module.exports = { encryptCredentials, decryptCredentials };
