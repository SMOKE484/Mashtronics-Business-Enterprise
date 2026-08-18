'use strict';
// JWT/JWKS mechanics themselves (malformed token, wrong key, expired, ES256,
// JWKS lookup failure) are already exhaustively covered against
// verifySupabaseToken in clientAuth.test.js — staffAuth.js imports that same
// function unmodified, so these tests focus on staffAuth.js's own logic:
// header extraction, per-model lookup, and the combined resolver.
jest.mock('../models/Technician', () => ({ findOne: jest.fn() }));
jest.mock('../models/ResponseOfficer', () => ({ findOne: jest.fn() }));
jest.mock('../middleware/clientAuth', () => ({ verifySupabaseToken: jest.fn() }));

const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');
const { verifySupabaseToken } = require('../middleware/clientAuth');
const { requireTechnicianAuth, requireResponseAuth, requireEitherStaffAuth } = require('../middleware/staffAuth');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('requireTechnicianAuth', () => {
  test('rejects when no Authorization header is present', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await requireTechnicianAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects when token verification fails', async () => {
    verifySupabaseToken.mockRejectedValue(new Error('bad token'));
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireTechnicianAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a valid token with no linked technician', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-1' });
    Technician.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireTechnicianAuth(req, res, next);

    expect(Technician.findOne).toHaveBeenCalledWith({ supabaseUserId: 'user-1', active: true });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No linked technician account' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 when the lookup throws', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-1' });
    Technician.findOne.mockRejectedValue(new Error('db down'));
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireTechnicianAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });

  test('attaches req.technician and req.supabaseUserId and calls next() for a valid, linked token', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-1' });
    const tech = { _id: 'tech-1', supabaseUserId: 'user-1' };
    Technician.findOne.mockResolvedValue(tech);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireTechnicianAuth(req, res, next);

    expect(req.technician).toBe(tech);
    expect(req.supabaseUserId).toBe('user-1');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireResponseAuth', () => {
  test('rejects a valid token with no linked officer', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-2' });
    ResponseOfficer.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireResponseAuth(req, res, next);

    expect(ResponseOfficer.findOne).toHaveBeenCalledWith({ supabaseUserId: 'user-2', active: true });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No linked response account' });
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches req.officer and req.supabaseUserId and calls next() for a valid, linked token', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-2' });
    const officer = { _id: 'officer-1', supabaseUserId: 'user-2' };
    ResponseOfficer.findOne.mockResolvedValue(officer);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireResponseAuth(req, res, next);

    expect(req.officer).toBe(officer);
    expect(req.supabaseUserId).toBe('user-2');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireEitherStaffAuth', () => {
  test('resolves as technician when a Technician matches (does not check ResponseOfficer)', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-1' });
    const tech = { _id: 'tech-1' };
    Technician.findOne.mockResolvedValue(tech);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireEitherStaffAuth(req, res, next);

    expect(req.staffType).toBe('technician');
    expect(req.staff).toBe(tech);
    expect(req.supabaseUserId).toBe('user-1');
    expect(ResponseOfficer.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('falls back to ResponseOfficer when no Technician matches', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-2' });
    Technician.findOne.mockResolvedValue(null);
    const officer = { _id: 'officer-1' };
    ResponseOfficer.findOne.mockResolvedValue(officer);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireEitherStaffAuth(req, res, next);

    expect(req.staffType).toBe('response');
    expect(req.staff).toBe(officer);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('401s with a combined message when neither matches', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-3' });
    Technician.findOne.mockResolvedValue(null);
    ResponseOfficer.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireEitherStaffAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No linked staff account' });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 when a lookup throws', async () => {
    verifySupabaseToken.mockResolvedValue({ sub: 'user-4' });
    Technician.findOne.mockRejectedValue(new Error('db down'));
    const req = { headers: { authorization: 'Bearer xyz' } };
    const res = mockRes();
    const next = jest.fn();

    await requireEitherStaffAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
