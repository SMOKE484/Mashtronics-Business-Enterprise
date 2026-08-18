'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const mockGetSigningKey = jest.fn();
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: mockGetSigningKey })));
jest.mock('../models/Client', () => ({ find: jest.fn() }));
jest.mock('../services/sms', () => ({ sendInviteSms: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/email', () => ({ sendInviteEmail: jest.fn().mockResolvedValue(undefined) }));

const Client = require('../models/Client');
const { sendInviteSms } = require('../services/sms');
const { sendInviteEmail } = require('../services/email');
const { requestInviteHandler } = require('../routes/appAuth');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function signToken(sub) {
  return jwt.sign({ sub }, privateKey, { algorithm: 'RS256', keyid: 'test-kid', expiresIn: '1h' });
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function makeClient(overrides = {}) {
  return {
    _id: 'client-1',
    contactPhone: '+27 82 414 0291',
    contactEmail: 'tumi.m@gmail.com',
    archived: false,
    appInviteCode: null,
    appInviteExpiresAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const GENERIC = { ok: true, message: 'If we found a matching account, a code has been sent.' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSigningKey.mockImplementation((kid, cb) => cb(null, { getPublicKey: () => publicKey }));
});

describe('POST /api/app/auth/request-invite', () => {
  test('rejects when no Authorization header is present', async () => {
    const req = { headers: {}, body: {} };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  test('rejects an invalid channel', async () => {
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0821234567', channel: 'carrier-pigeon' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'channel must be "sms" or "email"' });
  });

  test('rejects an invalid phone number', async () => {
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '123', channel: 'sms' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringMatching(/valid South African/) });
  });

  test('defaults to sms when channel is omitted', async () => {
    const client = makeClient();
    Client.find.mockResolvedValue([client]);
    const req = { headers: { authorization: `Bearer ${signToken('user-1')}` }, body: { phone: '0824140291' } };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(sendInviteSms).toHaveBeenCalledTimes(1);
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  test('matches on a normalized phone number and sends SMS to the on-file contactPhone, not the input', async () => {
    const client = makeClient({ contactPhone: '082 414 0291' });
    Client.find.mockResolvedValue([client]);
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '+27 82 414 0291', channel: 'sms' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(sendInviteSms).toHaveBeenCalledWith('+27824140291', client.appInviteCode);
    expect(res.json).toHaveBeenCalledWith(GENERIC);
  });

  test('sends via email to the on-file contactEmail when channel is email', async () => {
    const client = makeClient();
    Client.find.mockResolvedValue([client]);
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0824140291', channel: 'email' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(sendInviteEmail).toHaveBeenCalledWith('tumi.m@gmail.com', client.appInviteCode);
    expect(sendInviteSms).not.toHaveBeenCalled();
  });

  test('queries only unlinked clients (regression: an already-linked client sharing a phone must never get a fresh unsolicited code+SMS)', async () => {
    Client.find.mockResolvedValue([]);
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0824140291', channel: 'sms' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(Client.find).toHaveBeenCalledWith({ archived: false, supabaseUserId: { $exists: false } });
  });

  test('returns the generic response (not an error) when no client matches, to avoid enumeration', async () => {
    Client.find.mockResolvedValue([makeClient({ contactPhone: '+27 11 000 0000' })]);
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0824140291', channel: 'sms' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(sendInviteSms).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('requesting email delivery for a client with no contactEmail on file still returns the generic response', async () => {
    const client = makeClient({ contactEmail: '' });
    Client.find.mockResolvedValue([client]);
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0824140291', channel: 'email' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(sendInviteEmail).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('an SMS delivery failure is swallowed — still returns the generic response, code remains valid', async () => {
    sendInviteSms.mockRejectedValueOnce(new Error('Twilio: invalid number'));
    const client = makeClient();
    Client.find.mockResolvedValue([client]);
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0824140291', channel: 'sms' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(res.status).not.toHaveBeenCalled();
    expect(client.appInviteCode).not.toBeNull();
  });

  test('returns 500 when the Client lookup throws', async () => {
    Client.find.mockRejectedValue(new Error('db down'));
    const req = {
      headers: { authorization: `Bearer ${signToken('user-1')}` },
      body: { phone: '0824140291', channel: 'sms' },
    };
    const res = mockRes();

    await requestInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
