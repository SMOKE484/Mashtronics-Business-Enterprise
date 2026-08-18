'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const mockGetSigningKey = jest.fn();
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: mockGetSigningKey })));
jest.mock('../models/Client', () => ({ findOne: jest.fn() }));
jest.mock('../models/Technician', () => ({ findOne: jest.fn() }));
jest.mock('../models/ResponseOfficer', () => ({ findOne: jest.fn() }));
jest.mock('../services/supabaseLinks', () => ({
  linkClientAuthorization: jest.fn().mockResolvedValue(undefined),
  linkStaffAuthorization: jest.fn().mockResolvedValue(undefined),
}));

const Client = require('../models/Client');
const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');
const { linkClientAuthorization, linkStaffAuthorization } = require('../services/supabaseLinks');
const { claimHandler } = require('../routes/appAuth');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function signToken(sub, opts = {}) {
  return jwt.sign({ sub }, privateKey, { algorithm: 'RS256', keyid: 'test-kid', expiresIn: '1h', ...opts });
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSigningKey.mockImplementation((kid, cb) => cb(null, { getPublicKey: () => publicKey }));
});

describe('POST /api/app/auth/claim', () => {
  test('rejects when no Authorization header is present', async () => {
    const req = { headers: {}, body: {} };
    const res = mockRes();

    await claimHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  test('rejects a token that fails JWKS verification (e.g. wrong algorithm/signature)', async () => {
    mockGetSigningKey.mockImplementation((kid, cb) => cb(new Error('no matching key')));
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(Client.findOne).not.toHaveBeenCalled();
  });

  test('rejects a missing inviteCode', async () => {
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: {} };
    const res = mockRes();

    await claimHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'inviteCode is required' });
  });

  test('rejects an invalid or expired invite code', async () => {
    Client.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'DEADBEEF' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired invite code' });
  });

  test('the Client lookup excludes already-linked clients (regression: a stray valid code must never re-link an already-claimed account)', async () => {
    Client.findOne.mockResolvedValue(null);
    Technician.findOne.mockResolvedValue(null);
    ResponseOfficer.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(Client.findOne).toHaveBeenCalledWith({
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: expect.any(Object),
      archived: false,
      supabaseUserId: { $exists: false },
    });
  });

  test('links a valid token to the Client matching the invite code, clears the code, and calls linkClientAuthorization', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const client = {
      _id: 'client-1',
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: new Date(Date.now() + 1000),
      save,
    };
    Client.findOne.mockResolvedValue(client);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(client.supabaseUserId).toBe('user-1');
    expect(client.appInviteCode).toBeNull();
    expect(client.appInviteExpiresAt).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    expect(linkClientAuthorization).toHaveBeenCalledWith('user-1', 'client-1');
    expect(linkStaffAuthorization).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 500 when the Client lookup throws', async () => {
    Client.findOne.mockRejectedValue(new Error('db down'));
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });

  test('a Client match short-circuits — Technician and ResponseOfficer are never queried', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const client = {
      _id: 'client-1',
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: new Date(Date.now() + 1000),
      save,
    };
    Client.findOne.mockResolvedValue(client);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(Technician.findOne).not.toHaveBeenCalled();
    expect(ResponseOfficer.findOne).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('falls back to Technician when no Client matches, links, and does not call linkClientAuthorization', async () => {
    Client.findOne.mockResolvedValue(null);
    const save = jest.fn().mockResolvedValue(undefined);
    const technician = {
      _id: 'tech-1',
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: new Date(Date.now() + 1000),
      save,
    };
    Technician.findOne.mockResolvedValue(technician);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(Technician.findOne).toHaveBeenCalledWith({
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: expect.any(Object),
      active: true,
      supabaseUserId: { $exists: false },
    });
    expect(technician.supabaseUserId).toBe('user-1');
    expect(technician.appInviteCode).toBeNull();
    expect(technician.appInviteExpiresAt).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    expect(linkClientAuthorization).not.toHaveBeenCalled();
    expect(linkStaffAuthorization).toHaveBeenCalledWith('user-1', 'tech-1', 'technician');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(ResponseOfficer.findOne).not.toHaveBeenCalled();
  });

  test('falls back to ResponseOfficer when neither Client nor Technician match', async () => {
    Client.findOne.mockResolvedValue(null);
    Technician.findOne.mockResolvedValue(null);
    const save = jest.fn().mockResolvedValue(undefined);
    const officer = {
      _id: 'officer-1',
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: new Date(Date.now() + 1000),
      save,
    };
    ResponseOfficer.findOne.mockResolvedValue(officer);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'ABC12345' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(ResponseOfficer.findOne).toHaveBeenCalledWith({
      appInviteCode: 'ABC12345',
      appInviteExpiresAt: expect.any(Object),
      active: true,
      supabaseUserId: { $exists: false },
    });
    expect(officer.supabaseUserId).toBe('user-1');
    expect(officer.appInviteCode).toBeNull();
    expect(officer.appInviteExpiresAt).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    expect(linkClientAuthorization).not.toHaveBeenCalled();
    expect(linkStaffAuthorization).toHaveBeenCalledWith('user-1', 'officer-1', 'response');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when none of Client, Technician, or ResponseOfficer match', async () => {
    Client.findOne.mockResolvedValue(null);
    Technician.findOne.mockResolvedValue(null);
    ResponseOfficer.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { inviteCode: 'DEADBEEF' } };
    const res = mockRes();

    await claimHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired invite code' });
  });
});
