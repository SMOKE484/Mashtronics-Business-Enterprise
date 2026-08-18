'use strict';

const VALID_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

describe('deviceCredentials', () => {
  const originalKey = process.env.DAHUA_CREDENTIALS_KEY;

  afterEach(() => {
    process.env.DAHUA_CREDENTIALS_KEY = originalKey;
    jest.resetModules();
  });

  test('encrypt then decrypt round-trips the original object', () => {
    process.env.DAHUA_CREDENTIALS_KEY = VALID_KEY;
    jest.resetModules();
    const { encryptCredentials, decryptCredentials } = require('../services/deviceCredentials');

    const record = encryptCredentials({ username: 'admin', password: 'hunter2' });
    expect(record).toHaveProperty('iv');
    expect(record).toHaveProperty('authTag');
    expect(record).toHaveProperty('ciphertext');
    expect(record).toHaveProperty('encryptedAt');

    expect(decryptCredentials(record)).toEqual({ username: 'admin', password: 'hunter2' });
  });

  test('two encryptions of the same plaintext produce different iv and ciphertext', () => {
    process.env.DAHUA_CREDENTIALS_KEY = VALID_KEY;
    jest.resetModules();
    const { encryptCredentials } = require('../services/deviceCredentials');

    const a = encryptCredentials({ username: 'admin', password: 'hunter2' });
    const b = encryptCredentials({ username: 'admin', password: 'hunter2' });

    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  test('tampering with the ciphertext makes decryption throw', () => {
    process.env.DAHUA_CREDENTIALS_KEY = VALID_KEY;
    jest.resetModules();
    const { encryptCredentials, decryptCredentials } = require('../services/deviceCredentials');

    const record = encryptCredentials({ username: 'admin', password: 'hunter2' });
    const tampered = { ...record, ciphertext: (record.ciphertext[0] === 'a' ? 'b' : 'a') + record.ciphertext.slice(1) };

    expect(() => decryptCredentials(tampered)).toThrow('Credential decryption failed — ciphertext or key mismatch');
  });

  test('tampering with the authTag makes decryption throw', () => {
    process.env.DAHUA_CREDENTIALS_KEY = VALID_KEY;
    jest.resetModules();
    const { encryptCredentials, decryptCredentials } = require('../services/deviceCredentials');

    const record = encryptCredentials({ username: 'admin', password: 'hunter2' });
    const tampered = { ...record, authTag: (record.authTag[0] === 'a' ? 'b' : 'a') + record.authTag.slice(1) };

    expect(() => decryptCredentials(tampered)).toThrow('Credential decryption failed — ciphertext or key mismatch');
  });

  test('a missing DAHUA_CREDENTIALS_KEY throws synchronously on module load', () => {
    delete process.env.DAHUA_CREDENTIALS_KEY;
    jest.resetModules();
    expect(() => require('../services/deviceCredentials')).toThrow('DAHUA_CREDENTIALS_KEY must be a 64-character hex string');
  });

  test('a malformed (wrong-length) DAHUA_CREDENTIALS_KEY throws synchronously on module load', () => {
    process.env.DAHUA_CREDENTIALS_KEY = 'not-64-hex-chars';
    jest.resetModules();
    expect(() => require('../services/deviceCredentials')).toThrow('DAHUA_CREDENTIALS_KEY must be a 64-character hex string');
  });
});
