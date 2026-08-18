'use strict';
jest.mock('../models/Job', () => ({ create: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), findByIdAndDelete: jest.fn() }));
jest.mock('../models/Counter', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../services/jobNotifications', () => ({
  notifyTechnicianOfJob: jest.fn().mockResolvedValue(undefined),
  notifyTechnicianJobRemoved: jest.fn().mockResolvedValue(undefined),
}));
const Job = require('../models/Job');
const Counter = require('../models/Counter');
const { TEMPLATES } = require('../services/jobChecklists');
const { notifyTechnicianOfJob, notifyTechnicianJobRemoved } = require('../services/jobNotifications');
const { createHandler, updateHandler, deleteHandler, statusHandler } = require('../routes/jobs');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/jobs', () => {
  test('creates a job with a generated job number', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 42 });
    const job = { _id: 'j1', jobNumber: 'J42' };
    Job.create.mockResolvedValue(job);
    const req = { body: { jobType: 'Install', clientRef: 'c1', scheduledDate: '2026-08-01' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ jobNumber: 'J42' }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(job);
  });

  test('applies the jobType checklist template when the body has no checklist', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 43 });
    Job.create.mockResolvedValue({ _id: 'j1' });
    const req = { body: { jobType: 'CCTV install', clientRef: 'c1', scheduledDate: '2026-08-01' } };
    const res = mockRes();

    await createHandler(req, res);

    const created = Job.create.mock.calls[0][0];
    expect(created.checklist.map((i) => i.label)).toEqual(TEMPLATES.install);
    expect(created.checklist.every((i) => i.done === false)).toBe(true);
  });

  test('applies the template when checklist is an empty array', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 44 });
    Job.create.mockResolvedValue({ _id: 'j1' });
    const req = { body: { jobType: 'Camera repair', checklist: [] } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Job.create.mock.calls[0][0].checklist.map((i) => i.label)).toEqual(TEMPLATES.repair);
  });

  test('respects an explicitly provided checklist', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 45 });
    Job.create.mockResolvedValue({ _id: 'j1' });
    const custom = [{ label: 'Custom step', done: false }];
    const req = { body: { jobType: 'CCTV install', checklist: custom } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Job.create.mock.calls[0][0].checklist).toEqual(custom);
  });

  test('translates a save failure into a friendly message, never the raw Mongo string', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
    Job.create.mockRejectedValue({ name: 'ValidationError', errors: { jobType: { message: 'Path `jobType` is required.' } } });
    const req = { body: {} };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Path `jobType` is required.' });
  });

  test('notifies the assigned technician (as a fresh assignment) when a new job has a technicianRef', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 46 });
    const job = { _id: 'j1', technicianRef: 't1' };
    Job.create.mockResolvedValue(job);
    const req = { body: { jobType: 'CCTV install', technicianRef: 't1' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(notifyTechnicianOfJob).toHaveBeenCalledWith('j1', 't1', { isNewAssignment: true });
  });

  test('does not notify when a new job has no technician assigned', async () => {
    Counter.findOneAndUpdate.mockResolvedValue({ seq: 47 });
    Job.create.mockResolvedValue({ _id: 'j1' });
    const req = { body: { jobType: 'CCTV install' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(notifyTechnicianOfJob).not.toHaveBeenCalled();
  });
});

describe('PUT /api/jobs/:id', () => {
  test('updates and returns the job, stripping jobNumber from the body', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: null });
    const job = { _id: 'j1', jobType: 'Renamed', technicianRef: null };
    Job.findByIdAndUpdate.mockResolvedValue(job);
    const req = { params: { id: 'j1' }, body: { jobNumber: 'J99', jobType: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(Job.findByIdAndUpdate).toHaveBeenCalledWith('j1', { jobType: 'Renamed' }, { new: true, runValidators: true });
    expect(res.json).toHaveBeenCalledWith(job);
  });

  test('404s when the job does not exist (before-update lookup)', async () => {
    Job.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    expect(Job.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('404s when the job disappears between the before-lookup and the update', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: null });
    Job.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'j1' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('strips technician proof-of-work and status fields from admin edits', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: null });
    Job.findByIdAndUpdate.mockResolvedValue({ _id: 'j1', technicianRef: null });
    const req = {
      params: { id: 'j1' },
      body: {
        jobType: 'Renamed',
        checklist: [{ label: 'Keep me', done: true }],
        parts: ['PoE injector'],
        photos: [{ path: 'evil/override.jpg' }],
        signature: { svgPaths: ['M0 0'] },
        startedAt: '2026-01-01',
        completedAt: '2026-01-02',
        status: 'Completed',
      },
    };
    const res = mockRes();

    await updateHandler(req, res);

    const updates = Job.findByIdAndUpdate.mock.calls[0][1];
    expect(updates).toEqual({
      jobType: 'Renamed',
      checklist: [{ label: 'Keep me', done: true }],
      parts: ['PoE injector'],
    });
  });

  test('notifies the newly assigned technician when a job is assigned for the first time', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: null });
    Job.findByIdAndUpdate.mockResolvedValue({ _id: 'j1', technicianRef: 't1' });
    const req = { params: { id: 'j1' }, body: { technicianRef: 't1' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(notifyTechnicianJobRemoved).not.toHaveBeenCalled();
    expect(notifyTechnicianOfJob).toHaveBeenCalledWith('j1', 't1', { isNewAssignment: true });
  });

  test('notifies the old technician of removal and the new technician of assignment on reassignment', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: 't1' });
    Job.findByIdAndUpdate.mockResolvedValue({ _id: 'j1', technicianRef: 't2' });
    const req = { params: { id: 'j1' }, body: { technicianRef: 't2' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(notifyTechnicianJobRemoved).toHaveBeenCalledWith('j1', 't1');
    expect(notifyTechnicianOfJob).toHaveBeenCalledWith('j1', 't2', { isNewAssignment: true });
  });

  test('notifies the same technician (not a fresh assignment) on a plain field edit', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: 't1' });
    Job.findByIdAndUpdate.mockResolvedValue({ _id: 'j1', technicianRef: 't1' });
    const req = { params: { id: 'j1' }, body: { priority: 'High' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(notifyTechnicianJobRemoved).not.toHaveBeenCalled();
    expect(notifyTechnicianOfJob).toHaveBeenCalledWith('j1', 't1', { isNewAssignment: false });
  });

  test('notifies the old technician of removal when unassigned outright', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: 't1' });
    Job.findByIdAndUpdate.mockResolvedValue({ _id: 'j1', technicianRef: null });
    const req = { params: { id: 'j1' }, body: { technicianRef: null } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(notifyTechnicianJobRemoved).toHaveBeenCalledWith('j1', 't1');
    expect(notifyTechnicianOfJob).not.toHaveBeenCalled();
  });

  test('does not notify at all when the job never had a technician', async () => {
    Job.findById.mockResolvedValue({ _id: 'j1', technicianRef: null });
    Job.findByIdAndUpdate.mockResolvedValue({ _id: 'j1', technicianRef: null });
    const req = { params: { id: 'j1' }, body: { priority: 'High' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(notifyTechnicianJobRemoved).not.toHaveBeenCalled();
    expect(notifyTechnicianOfJob).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/jobs/:id/status', () => {
  function mockJobDoc(overrides = {}) {
    return { status: 'Scheduled', startedAt: null, completedAt: null, save: jest.fn().mockResolvedValue(), ...overrides };
  }

  test('rejects an unknown status', async () => {
    const req = { params: { id: 'j1' }, body: { status: 'Paused' } };
    const res = mockRes();

    await statusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid status' });
  });

  test('404s when the job does not exist', async () => {
    Job.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: { status: 'Completed' } };
    const res = mockRes();

    await statusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('notifies the assigned technician (not a fresh assignment) of a status change', async () => {
    const job = mockJobDoc({ _id: 'j1', technicianRef: 't1' });
    Job.findById.mockResolvedValue(job);
    const req = { params: { id: 'j1' }, body: { status: 'Completed' } };
    const res = mockRes();

    await statusHandler(req, res);

    expect(notifyTechnicianOfJob).toHaveBeenCalledWith('j1', 't1', { isNewAssignment: false });
  });

  test('does not notify when the job has no technician assigned', async () => {
    const job = mockJobDoc({ _id: 'j1' });
    Job.findById.mockResolvedValue(job);
    const req = { params: { id: 'j1' }, body: { status: 'Completed' } };
    const res = mockRes();

    await statusHandler(req, res);

    expect(notifyTechnicianOfJob).not.toHaveBeenCalled();
  });

  test('stamps startedAt when moving to In Progress', async () => {
    const job = mockJobDoc();
    Job.findById.mockResolvedValue(job);
    const req = { params: { id: 'j1' }, body: { status: 'In Progress' } };
    const res = mockRes();

    await statusHandler(req, res);

    expect(job.status).toBe('In Progress');
    expect(job.startedAt).toBeInstanceOf(Date);
    expect(job.save).toHaveBeenCalled();
  });

  test('stamps completedAt when moving to Completed', async () => {
    const job = mockJobDoc({ status: 'In Progress', startedAt: new Date('2026-07-12T08:00:00Z') });
    Job.findById.mockResolvedValue(job);
    const req = { params: { id: 'j1' }, body: { status: 'Completed' } };
    const res = mockRes();

    await statusHandler(req, res);

    expect(job.completedAt).toBeInstanceOf(Date);
  });

  test('does not overwrite an existing startedAt/completedAt', async () => {
    const started = new Date('2026-07-12T08:00:00Z');
    const completed = new Date('2026-07-12T10:00:00Z');
    const job = mockJobDoc({ status: 'Completed', startedAt: started, completedAt: completed });
    Job.findById.mockResolvedValue(job);
    const res = mockRes();

    await statusHandler({ params: { id: 'j1' }, body: { status: 'In Progress' } }, res);
    expect(job.startedAt).toBe(started);

    await statusHandler({ params: { id: 'j1' }, body: { status: 'Completed' } }, res);
    expect(job.completedAt).toBe(completed);
  });
});

describe('DELETE /api/jobs/:id', () => {
  test('deletes an existing job', async () => {
    Job.findByIdAndDelete.mockResolvedValue({ _id: 'j1' });
    const req = { params: { id: 'j1' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(Job.findByIdAndDelete).toHaveBeenCalledWith('j1');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('404s when the job does not exist', async () => {
    Job.findByIdAndDelete.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('returns 500 when the delete throws', async () => {
    Job.findByIdAndDelete.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'j1' } };
    const res = mockRes();

    await deleteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
