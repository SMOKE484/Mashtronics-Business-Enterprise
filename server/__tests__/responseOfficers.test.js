'use strict';
jest.mock('../models/ResponseOfficer', () => ({ create: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() }));
const ResponseOfficer = require('../models/ResponseOfficer');
const { createHandler, updateHandler, hardDeleteHandler, deactivateHandler } = require('../routes/responseOfficers');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/response-officers', () => {
  test('creates and returns the new officer (defaults to inactive, so no completeness check blocks it)', async () => {
    const officer = { _id: 'r1', name: 'Officer One' };
    ResponseOfficer.create.mockResolvedValue(officer);
    const req = { body: { name: 'Officer One' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(officer);
  });

  test('a second officer with no supabaseUserId does not collide (regression: sparse-index null default)', async () => {
    ResponseOfficer.create.mockResolvedValue({ _id: 'r2', name: 'Officer Two' });
    const req = { body: { name: 'Officer Two' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  test('translates a genuine duplicate-key error into a friendly message, never the raw Mongo string', async () => {
    ResponseOfficer.create.mockRejectedValue({
      code: 11000,
      keyPattern: { supabaseUserId: 1 },
      message: 'E11000 duplicate key error collection: mashtronics.responseofficers index: supabaseUserId_1 dup key: { supabaseUserId: null }',
    });
    const req = { body: { name: 'Officer One' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|collection:|dup key/);
    expect(error).toBe('A response officer with that supabaseUserId already exists.');
  });

  test('rejects creating an active officer with missing phone/email/role, without ever calling create', async () => {
    const req = { body: { name: 'Officer One', active: true, phone: '', email: '', role: '' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(ResponseOfficer.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Active response officers need phone, email, and role filled in — phone, email, role are missing.',
    });
  });

  test('allows creating an active officer when phone/email/role are all provided', async () => {
    const officer = { _id: 'r1', name: 'Officer One', active: true };
    ResponseOfficer.create.mockResolvedValue(officer);
    const req = { body: { name: 'Officer One', active: true, phone: '082 123 4567', email: 'o@example.com', role: 'Response Officer' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(officer);
  });
});

describe('PUT /api/response-officers/:id', () => {
  test('updates and returns the officer', async () => {
    const current = { _id: 'r1', name: 'Old', phone: '082 123 4567', email: 'o@example.com', role: 'Response Officer', active: false };
    const updated = { _id: 'r1', name: 'Renamed' };
    ResponseOfficer.findById.mockResolvedValue(current);
    ResponseOfficer.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 'r1' }, body: { name: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('404s when the officer does not exist', async () => {
    ResponseOfficer.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    ResponseOfficer.findById.mockResolvedValue({ phone: '082 123 4567', email: 'o@example.com', role: 'Response Officer', active: false });
    ResponseOfficer.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: E11000 duplicate key error'));
    const req = { params: { id: 'r1' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|MongoServerError/);
  });

  test('rejects activating an officer whose current record is missing a field, without ever calling update', async () => {
    ResponseOfficer.findById.mockResolvedValue({ _id: 'r1', phone: '', email: 'o@example.com', role: 'Response Officer', active: false });
    const req = { params: { id: 'r1' }, body: { active: true } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(ResponseOfficer.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Active response officers need phone, email, and role filled in — phone is missing.',
    });
  });

  test('rejects clearing a required field on an already-active officer, even without touching `active` in the body', async () => {
    ResponseOfficer.findById.mockResolvedValue({ _id: 'r1', phone: '082 123 4567', email: 'o@example.com', role: 'Response Officer', active: true });
    const req = { params: { id: 'r1' }, body: { phone: '' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(ResponseOfficer.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Active response officers need phone, email, and role filled in — phone is missing.',
    });
  });

  test('allows editing an inactive officer even while fields stay incomplete', async () => {
    const current = { _id: 'r1', phone: '', email: '', role: '', active: false };
    const updated = { _id: 'r1', name: 'Renamed', active: false };
    ResponseOfficer.findById.mockResolvedValue(current);
    ResponseOfficer.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 'r1' }, body: { name: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('allows activating an officer once the request body fills in the missing fields', async () => {
    ResponseOfficer.findById.mockResolvedValue({ _id: 'r1', phone: '', email: '', role: '', active: false });
    const updated = { _id: 'r1', active: true };
    ResponseOfficer.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 'r1' }, body: { active: true, phone: '082 123 4567', email: 'o@example.com', role: 'Response Officer' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

describe('DELETE /api/response-officers/:id', () => {
  test('deactivates and clears the SecureWatch app identity link (regression: archived-then-reclaimed sparse-index collision)', async () => {
    const updated = { _id: 'r1', name: 'Officer One', active: false };
    ResponseOfficer.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 'r1' } };
    const res = mockRes();

    await deactivateHandler(req, res);

    expect(ResponseOfficer.findByIdAndUpdate).toHaveBeenCalledWith(
      'r1',
      { active: false, $unset: { supabaseUserId: '', appInviteCode: '', appInviteExpiresAt: '' } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the officer does not exist', async () => {
    ResponseOfficer.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await deactivateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    ResponseOfficer.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: something broke'));
    const req = { params: { id: 'r1' } };
    const res = mockRes();

    await deactivateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});

describe('DELETE /api/response-officers/:id/permanent', () => {
  test('hard-deletes and returns ok', async () => {
    ResponseOfficer.findByIdAndDelete.mockResolvedValue({ _id: 'r1', name: 'Officer One' });
    const req = { params: { id: 'r1' } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(ResponseOfficer.findByIdAndDelete).toHaveBeenCalledWith('r1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the officer does not exist', async () => {
    ResponseOfficer.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });
});
