'use strict';
jest.mock('../models/Technician', () => ({ create: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock('../models/Job', () => ({ countDocuments: jest.fn(), updateMany: jest.fn() }));
jest.mock('../services/jobNotifications', () => ({ notifyBulkReassign: jest.fn().mockResolvedValue(undefined) }));
const Technician = require('../models/Technician');
const Job = require('../models/Job');
const { notifyBulkReassign } = require('../services/jobNotifications');
const { createHandler, updateHandler, jobsCountHandler, hardDeleteHandler, deactivateHandler } = require('../routes/technicians');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/technicians', () => {
  test('creates and returns the new technician (defaults to inactive, so no completeness check blocks it)', async () => {
    const tech = { _id: 't1', name: 'Vhulenda' };
    Technician.create.mockResolvedValue(tech);
    const req = { body: { name: 'Vhulenda' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(tech);
  });

  test('a second technician with no supabaseUserId does not collide (regression: sparse-index null default)', async () => {
    // Prior bug: `default: null` on supabaseUserId meant every unlinked
    // technician stored a literal null, which a sparse unique index still
    // indexes — so the second unlinked technician always hit E11000.
    // With the default removed, Technician.create is never actually asked
    // to persist a `supabaseUserId: null`, so it never throws for this reason.
    Technician.create.mockResolvedValue({ _id: 't2', name: 'Second Tech' });
    const req = { body: { name: 'Second Tech' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Technician.create).toHaveBeenCalledWith({ name: 'Second Tech' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ error: expect.anything() }));
  });

  test('translates a genuine duplicate-key error into a friendly message, never the raw Mongo string', async () => {
    Technician.create.mockRejectedValue({
      code: 11000,
      keyPattern: { supabaseUserId: 1 },
      message: 'E11000 duplicate key error collection: mashtronics.technicians index: supabaseUserId_1 dup key: { supabaseUserId: null }',
    });
    const req = { body: { name: 'Vhulenda' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|collection:|dup key/);
    expect(error).toBe('A technician with that supabaseUserId already exists.');
  });

  test('translates a validation error into a friendly message', async () => {
    Technician.create.mockRejectedValue({
      name: 'ValidationError',
      errors: { name: { message: 'Path `name` is required.' } },
    });
    const req = { body: {} };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Path `name` is required.' });
  });

  test('rejects creating an active technician with missing phone/email/role, without ever calling create', async () => {
    const req = { body: { name: 'Vhulenda', active: true, phone: '', email: '', role: '' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Technician.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Active technicians need phone, email, and role filled in — phone, email, role are missing.',
    });
  });

  test('allows creating an active technician when phone/email/role are all provided', async () => {
    const tech = { _id: 't1', name: 'Vhulenda', active: true };
    Technician.create.mockResolvedValue(tech);
    const req = { body: { name: 'Vhulenda', active: true, phone: '082 123 4567', email: 'v@example.com', role: 'Installer' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(tech);
  });
});

describe('PUT /api/technicians/:id', () => {
  test('updates and returns the technician', async () => {
    const current = { _id: 't1', name: 'Old', phone: '082 123 4567', email: 'v@example.com', role: 'Installer', active: false };
    const updated = { _id: 't1', name: 'Renamed' };
    Technician.findById.mockResolvedValue(current);
    Technician.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 't1' }, body: { name: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('404s when the technician does not exist', async () => {
    Technician.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    Technician.findById.mockResolvedValue({ phone: '082 123 4567', email: 'v@example.com', role: 'Installer', active: false });
    Technician.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: E11000 duplicate key error'));
    const req = { params: { id: 't1' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|MongoServerError/);
  });

  test('rejects activating a technician whose current record is missing a field, without ever calling update', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', phone: '', email: 'v@example.com', role: 'Installer', active: false });
    const req = { params: { id: 't1' }, body: { active: true } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(Technician.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Active technicians need phone, email, and role filled in — phone is missing.',
    });
  });

  test('rejects clearing a required field on an already-active technician, even without touching `active` in the body', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', phone: '082 123 4567', email: 'v@example.com', role: 'Installer', active: true });
    const req = { params: { id: 't1' }, body: { phone: '' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(Technician.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Active technicians need phone, email, and role filled in — phone is missing.',
    });
  });

  test('allows editing an inactive technician even while fields stay incomplete', async () => {
    const current = { _id: 't1', phone: '', email: '', role: '', active: false };
    const updated = { _id: 't1', name: 'Renamed', active: false };
    Technician.findById.mockResolvedValue(current);
    Technician.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 't1' }, body: { name: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('allows activating a technician once the request body fills in the missing fields', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', phone: '', email: '', role: '', active: false });
    const updated = { _id: 't1', active: true };
    Technician.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 't1' }, body: { active: true, phone: '082 123 4567', email: 'v@example.com', role: 'Installer' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

describe('GET /api/technicians/:id/jobs-count', () => {
  test('returns the count of jobs referencing this technician', async () => {
    Job.countDocuments.mockResolvedValue(3);
    const req = { params: { id: 't1' } };
    const res = mockRes();

    await jobsCountHandler(req, res);

    expect(Job.countDocuments).toHaveBeenCalledWith({ technicianRef: 't1' });
    expect(res.json).toHaveBeenCalledWith({ count: 3 });
  });
});

describe('DELETE /api/technicians/:id', () => {
  test('deactivates and clears the SecureWatch app identity link (regression: deactivated-then-reclaimed sparse-index collision)', async () => {
    const updated = { _id: 't1', name: 'Vhulenda', active: false };
    Technician.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 't1' } };
    const res = mockRes();

    await deactivateHandler(req, res);

    expect(Technician.findByIdAndUpdate).toHaveBeenCalledWith(
      't1',
      { active: false, $unset: { supabaseUserId: '', appInviteCode: '', appInviteExpiresAt: '' } },
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the technician does not exist', async () => {
    Technician.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await deactivateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    Technician.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: something broke'));
    const req = { params: { id: 't1' } };
    const res = mockRes();

    await deactivateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});

describe('DELETE /api/technicians/:id/permanent', () => {
  test('404s when the technician does not exist', async () => {
    Technician.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Technician.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('deletes outright when the technician has no jobs on record', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', name: 'Vhulenda' });
    Job.countDocuments.mockResolvedValue(0);
    const req = { params: { id: 't1' }, body: {} };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(Job.updateMany).not.toHaveBeenCalled();
    expect(Technician.findByIdAndDelete).toHaveBeenCalledWith('t1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('409s with the job count when jobs exist and the caller has not yet decided how to handle them', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', name: 'Vhulenda' });
    Job.countDocuments.mockResolvedValue(2);
    const req = { params: { id: 't1' }, body: {} };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Vhulenda has 2 jobs assigned — choose whether to reassign them or leave them unassigned before deleting.', jobCount: 2 });
    expect(Technician.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('reassigns jobs to another technician when reassignTo is a valid id, then deletes', async () => {
    Technician.findById.mockResolvedValueOnce({ _id: 't1', name: 'Vhulenda' }).mockResolvedValueOnce({ _id: 't2', name: 'Other Tech' });
    Job.countDocuments.mockResolvedValue(2);
    const req = { params: { id: 't1' }, body: { reassignTo: 't2' } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(Job.updateMany).toHaveBeenCalledWith({ technicianRef: 't1' }, { $set: { technicianRef: 't2' } });
    expect(Technician.findByIdAndDelete).toHaveBeenCalledWith('t1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(notifyBulkReassign).toHaveBeenCalledWith('t2', 2, 'Vhulenda');
  });

  test('does not notify anyone when jobs are left unassigned (vacated) rather than reassigned', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', name: 'Vhulenda' });
    Job.countDocuments.mockResolvedValue(2);
    const req = { params: { id: 't1' }, body: { reassignTo: null } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(notifyBulkReassign).not.toHaveBeenCalled();
  });

  test('rejects reassigning a technician\'s jobs to themselves', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', name: 'Vhulenda' });
    Job.countDocuments.mockResolvedValue(2);
    const req = { params: { id: 't1' }, body: { reassignTo: 't1' } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Job.updateMany).not.toHaveBeenCalled();
    expect(Technician.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('rejects reassigning to a technician that does not exist', async () => {
    Technician.findById.mockResolvedValueOnce({ _id: 't1', name: 'Vhulenda' }).mockResolvedValueOnce(null);
    Job.countDocuments.mockResolvedValue(2);
    const req = { params: { id: 't1' }, body: { reassignTo: 'ghost' } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Job.updateMany).not.toHaveBeenCalled();
    expect(Technician.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('vacates jobs (unsets technicianRef) when reassignTo is explicitly null', async () => {
    Technician.findById.mockResolvedValue({ _id: 't1', name: 'Vhulenda' });
    Job.countDocuments.mockResolvedValue(2);
    const req = { params: { id: 't1' }, body: { reassignTo: null } };
    const res = mockRes();

    await hardDeleteHandler(req, res);

    expect(Job.updateMany).toHaveBeenCalledWith({ technicianRef: 't1' }, { $unset: { technicianRef: '' } });
    expect(Technician.findByIdAndDelete).toHaveBeenCalledWith('t1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
