'use strict';
jest.mock('../models/Client', () => ({ create: jest.fn(), findByIdAndUpdate: jest.fn() }));
const Client = require('../models/Client');
const { createHandler, updateHandler, archiveHandler } = require('../routes/clients');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/clients', () => {
  test('creates and returns the new client', async () => {
    const client = { _id: 'c1', name: 'New Client' };
    Client.create.mockResolvedValue(client);
    const req = { body: { name: 'New Client' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(client);
  });

  test('a second unlinked client does not collide (regression: sparse-index null default)', async () => {
    Client.create.mockResolvedValue({ _id: 'c2', name: 'Second Client' });
    const req = { body: { name: 'Second Client' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  test('translates a genuine duplicate-key error into a friendly message, never the raw Mongo string', async () => {
    Client.create.mockRejectedValue({
      code: 11000,
      keyPattern: { supabaseUserId: 1 },
      message: 'E11000 duplicate key error collection: mashtronics.clients index: supabaseUserId_1 dup key: { supabaseUserId: null }',
    });
    const req = { body: { name: 'New Client' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|collection:|dup key/);
    expect(error).toBe('A client with that supabaseUserId already exists.');
  });
});

describe('PUT /api/clients/:id', () => {
  test('updates and returns the client', async () => {
    const client = { _id: 'c1', name: 'Renamed' };
    Client.findByIdAndUpdate.mockResolvedValue(client);
    const req = { params: { id: 'c1' }, body: { name: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(client);
  });

  test('404s when the client does not exist', async () => {
    Client.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    Client.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: E11000 duplicate key error'));
    const req = { params: { id: 'c1' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|MongoServerError/);
  });
});

describe('DELETE /api/clients/:id', () => {
  test('archives and clears the SecureWatch app identity link (regression: archived-then-reclaimed sparse-index collision)', async () => {
    const updated = { _id: 'c1', name: 'Old Client', archived: true };
    Client.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await archiveHandler(req, res);

    expect(Client.findByIdAndUpdate).toHaveBeenCalledWith(
      'c1',
      { archived: true, $unset: { supabaseUserId: '', appInviteCode: '', appInviteExpiresAt: '' } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the client does not exist', async () => {
    Client.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await archiveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    Client.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: something broke'));
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await archiveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
