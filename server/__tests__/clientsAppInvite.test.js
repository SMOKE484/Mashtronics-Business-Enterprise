'use strict';
jest.mock('../models/Client', () => ({ findById: jest.fn() }));
const Client = require('../models/Client');
const { appInviteHandler } = require('../routes/clients');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/clients/:id/app-invite', () => {
  test('404s when the client does not exist', async () => {
    Client.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('404s for an archived client', async () => {
    Client.findById.mockResolvedValue({ archived: true, save: jest.fn() });
    const req = { params: { id: 'client-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('issues and returns a fresh invite code for an active client', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const client = { archived: false, appInviteCode: null, appInviteExpiresAt: null, save };
    Client.findById.mockResolvedValue(client);
    const req = { params: { id: 'client-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      inviteCode: client.appInviteCode,
      expiresAt: client.appInviteExpiresAt,
    });
    expect(client.appInviteCode).toMatch(/^[0-9A-F]{8}$/);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 500 when the lookup throws', async () => {
    Client.findById.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'client-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
