'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const mockGetSigningKey = jest.fn();
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: mockGetSigningKey })));
jest.mock('../models/Client', () => ({ findOne: jest.fn() }));

const Client = require('../models/Client');
const { requireClientAuth } = require('../middleware/clientAuth');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const { publicKey: otherPublicKey, privateKey: otherPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function signToken(sub, { privateKeyOverride, kid = 'test-kid', algorithm = 'RS256', expiresIn = '1h' } = {}) {
  return jwt.sign({ sub }, privateKeyOverride || privateKey, { algorithm, keyid: kid, expiresIn });
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSigningKey.mockImplementation((kid, cb) => {
    cb(null, { getPublicKey: () => publicKey });
  });
});

describe('requireClientAuth', () => {
  test('rejects when no Authorization header is present', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a malformed bearer token', async () => {
    const req = { headers: { authorization: 'Bearer not-a-jwt' } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a token with no kid header', async () => {
    const noKidToken = jwt.sign({ sub: 'user-1' }, privateKey, { algorithm: 'RS256' });
    const req = { headers: { authorization: `Bearer ${noKidToken}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(mockGetSigningKey).not.toHaveBeenCalled();
  });

  test('rejects a token signed with a key not published in the JWKS (signature mismatch)', async () => {
    const token = signToken('user-1', { privateKeyOverride: otherPrivateKey });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an expired token', async () => {
    const token = signToken('user-1', { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  test('rejects when the JWKS lookup itself fails (e.g. unknown kid, network error)', async () => {
    mockGetSigningKey.mockImplementation((kid, cb) => cb(new Error('kid not found')));
    const token = signToken('user-1');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  test('rejects a valid token with no linked Client record', async () => {
    Client.findOne.mockResolvedValue(null);
    const token = signToken('user-unlinked');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(Client.findOne).toHaveBeenCalledWith({ supabaseUserId: 'user-unlinked', archived: false });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No linked client account' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 when the Client lookup throws', async () => {
    Client.findOne.mockRejectedValue(new Error('db down'));
    const token = signToken('user-1');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });

  test('attaches req.client and req.supabaseUserId and calls next() for a valid, linked token', async () => {
    const client = { _id: 'client-1', supabaseUserId: 'user-1', archived: false };
    Client.findOne.mockResolvedValue(client);
    const token = signToken('user-1');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(req.client).toBe(client);
    expect(req.supabaseUserId).toBe('user-1');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('accepts an ES256-signed token verified against its published EC key', async () => {
    const { publicKey: ecPub, privateKey: ecPriv } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    mockGetSigningKey.mockImplementation((kid, cb) => cb(null, { getPublicKey: () => ecPub }));
    Client.findOne.mockResolvedValue({ _id: 'client-2', supabaseUserId: 'user-2' });

    const token = jwt.sign({ sub: 'user-2' }, ecPriv, { algorithm: 'ES256', keyid: 'ec-kid' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    await requireClientAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.supabaseUserId).toBe('user-2');
  });
});
