'use strict';
jest.mock('../models/Job', () => ({ findById: jest.fn() }));
jest.mock('../models/Technician', () => ({ findById: jest.fn() }));
jest.mock('../services/jobs', () => ({ toAppJob: jest.fn() }));
jest.mock('../services/realtime', () => ({ broadcastToStaff: jest.fn() }));
jest.mock('../services/pushNotifications', () => ({ pushToStaff: jest.fn() }));

const Job = require('../models/Job');
const Technician = require('../models/Technician');
const { toAppJob } = require('../services/jobs');
const { broadcastToStaff } = require('../services/realtime');
const { pushToStaff } = require('../services/pushNotifications');
const {
  notifyTechnicianOfJob, notifyTechnicianJobRemoved, notifyBulkReassign,
} = require('../services/jobNotifications');

function mockPopulateChain(doc) {
  Job.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(doc) });
}

beforeEach(() => {
  jest.clearAllMocks();
  broadcastToStaff.mockResolvedValue(undefined);
  pushToStaff.mockResolvedValue({ sent: true });
});

describe('notifyTechnicianOfJob', () => {
  test('broadcasts job:upsert with the app-shaped job', async () => {
    mockPopulateChain({ _id: 'j1' });
    toAppJob.mockResolvedValue({ id: 'j1', jobType: 'CCTV install', client: 'Tumi' });

    await notifyTechnicianOfJob('j1', 't1', { isNewAssignment: false });

    expect(broadcastToStaff).toHaveBeenCalledWith('t1', 'job:upsert', { id: 'j1', jobType: 'CCTV install', client: 'Tumi' });
  });

  test('does nothing when the job no longer exists', async () => {
    mockPopulateChain(null);

    await notifyTechnicianOfJob('missing', 't1', { isNewAssignment: true });

    expect(broadcastToStaff).not.toHaveBeenCalled();
    expect(pushToStaff).not.toHaveBeenCalled();
  });

  test('sends a push notification only for a fresh assignment, naming the client', async () => {
    mockPopulateChain({ _id: 'j1' });
    toAppJob.mockResolvedValue({ id: 'j1', jobType: 'CCTV install', client: 'Tumi' });
    Technician.findById.mockResolvedValue({ _id: 't1', expoPushToken: 'tok' });

    await notifyTechnicianOfJob('j1', 't1', { isNewAssignment: true });

    expect(pushToStaff).toHaveBeenCalledWith(
      { _id: 't1', expoPushToken: 'tok' },
      { title: 'New job assigned', body: 'CCTV install — Tumi', data: { jobId: 'j1' } }
    );
  });

  test('push body falls back to just the job type when there is no client name', async () => {
    mockPopulateChain({ _id: 'j1' });
    toAppJob.mockResolvedValue({ id: 'j1', jobType: 'CCTV install', client: '' });
    Technician.findById.mockResolvedValue({ _id: 't1', expoPushToken: 'tok' });

    await notifyTechnicianOfJob('j1', 't1', { isNewAssignment: true });

    expect(pushToStaff).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ body: 'CCTV install' }));
  });

  test('does not push on a plain edit (not a fresh assignment)', async () => {
    mockPopulateChain({ _id: 'j1' });
    toAppJob.mockResolvedValue({ id: 'j1', jobType: 'CCTV install', client: 'Tumi' });

    await notifyTechnicianOfJob('j1', 't1', { isNewAssignment: false });

    expect(pushToStaff).not.toHaveBeenCalled();
  });

  test('never throws when the broadcast fails', async () => {
    mockPopulateChain({ _id: 'j1' });
    toAppJob.mockResolvedValue({ id: 'j1', jobType: 'CCTV install', client: 'Tumi' });
    broadcastToStaff.mockRejectedValue(new Error('network down'));

    await expect(notifyTechnicianOfJob('j1', 't1', { isNewAssignment: false })).resolves.toBeUndefined();
  });

  test('never throws when the job lookup itself throws', async () => {
    Job.findById.mockImplementation(() => { throw new Error('db down'); });

    await expect(notifyTechnicianOfJob('j1', 't1', { isNewAssignment: true })).resolves.toBeUndefined();
  });
});

describe('notifyTechnicianJobRemoved', () => {
  test('broadcasts job:remove with the stringified id', async () => {
    await notifyTechnicianJobRemoved('507f1f77bcf86cd799439011', 't1');
    expect(broadcastToStaff).toHaveBeenCalledWith('t1', 'job:remove', { id: '507f1f77bcf86cd799439011' });
  });

  test('never throws when the broadcast fails', async () => {
    broadcastToStaff.mockRejectedValue(new Error('network down'));
    await expect(notifyTechnicianJobRemoved('j1', 't1')).resolves.toBeUndefined();
  });
});

describe('notifyBulkReassign', () => {
  test('broadcasts jobs:refresh and pushes an aggregate notification (plural)', async () => {
    Technician.findById.mockResolvedValue({ _id: 't2', expoPushToken: 'tok' });

    await notifyBulkReassign('t2', 3, 'Vhulenda');

    expect(broadcastToStaff).toHaveBeenCalledWith('t2', 'jobs:refresh', {});
    expect(pushToStaff).toHaveBeenCalledWith(
      { _id: 't2', expoPushToken: 'tok' },
      { title: 'Jobs reassigned to you', body: '3 jobs previously assigned to Vhulenda are now yours.' }
    );
  });

  test('uses singular phrasing for exactly one job', async () => {
    Technician.findById.mockResolvedValue({ _id: 't2', expoPushToken: 'tok' });

    await notifyBulkReassign('t2', 1, 'Vhulenda');

    expect(pushToStaff).toHaveBeenCalledWith(
      expect.anything(),
      { title: 'Jobs reassigned to you', body: '1 job previously assigned to Vhulenda is now yours.' }
    );
  });

  test('never throws when the technician lookup fails', async () => {
    Technician.findById.mockRejectedValue(new Error('db down'));
    await expect(notifyBulkReassign('t2', 2, 'Vhulenda')).resolves.toBeUndefined();
  });
});
