'use strict';
jest.mock('../models/DahuaPendingBind', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../models/Camera', () => ({ create: jest.fn() }));
jest.mock('../models/Client', () => ({ findOne: jest.fn() }));
jest.mock('../services/dahua', () => ({ setActivationStatus: jest.fn() }));

const DahuaPendingBind = require('../models/DahuaPendingBind');
const Camera            = require('../models/Camera');
const Client             = require('../models/Client');
const dahua               = require('../services/dahua');
const { listHandler, resolveHandler, ignoreHandler } = require('../routes/dahuaPendingBinds');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/dahua-pending-binds', () => {
  test('defaults to status=pending and returns the populated list', async () => {
    const populate2 = jest.fn().mockResolvedValue([{ _id: 'pb1', deviceSerial: 'SN1' }]);
    const populate1 = jest.fn(() => ({ populate: populate2 }));
    const sort = jest.fn(() => ({ populate: populate1 }));
    DahuaPendingBind.find.mockReturnValue({ sort });

    const res = mockRes();
    await listHandler({ query: {} }, res);

    expect(DahuaPendingBind.find).toHaveBeenCalledWith({ status: 'pending' });
    expect(res.json).toHaveBeenCalledWith([{ _id: 'pb1', deviceSerial: 'SN1' }]);
  });

  test('ignores an invalid status query and falls back to pending', async () => {
    const populate2 = jest.fn().mockResolvedValue([]);
    const populate1 = jest.fn(() => ({ populate: populate2 }));
    const sort = jest.fn(() => ({ populate: populate1 }));
    DahuaPendingBind.find.mockReturnValue({ sort });

    await listHandler({ query: { status: 'not-a-real-status' } }, mockRes());

    expect(DahuaPendingBind.find).toHaveBeenCalledWith({ status: 'pending' });
  });
});

describe('POST /:id/resolve', () => {
  test('404s when the pending bind does not exist', async () => {
    DahuaPendingBind.findById.mockResolvedValue(null);
    const res = mockRes();
    await resolveHandler({ params: { id: 'pb1' }, body: { clientRef: 'c1' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('404s when the pending bind was already resolved/ignored', async () => {
    DahuaPendingBind.findById.mockResolvedValue({ status: 'resolved' });
    const res = mockRes();
    await resolveHandler({ params: { id: 'pb1' }, body: { clientRef: 'c1' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400s when no clientRef is supplied', async () => {
    DahuaPendingBind.findById.mockResolvedValue({ status: 'pending' });
    const res = mockRes();
    await resolveHandler({ params: { id: 'pb1' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dahua.setActivationStatus).not.toHaveBeenCalled();
  });

  test('400s when the supplied client cannot be found', async () => {
    DahuaPendingBind.findById.mockResolvedValue({ status: 'pending', deviceSerial: 'SN1' });
    Client.findOne.mockResolvedValue(null);
    const res = mockRes();
    await resolveHandler({ params: { id: 'pb1' }, body: { clientRef: 'ghost' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('502s and creates no Camera when Dahua activation fails', async () => {
    DahuaPendingBind.findById.mockResolvedValue({ status: 'pending', deviceSerial: 'SN1' });
    Client.findOne.mockResolvedValue({ _id: 'c1' });
    dahua.setActivationStatus.mockRejectedValue(new Error('BIZ084'));
    const res = mockRes();

    await resolveHandler({ params: { id: 'pb1' }, body: { clientRef: 'c1', name: 'Front Gate' } }, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(Camera.create).not.toHaveBeenCalled();
  });

  test('activates, creates the Camera, and marks the pending bind resolved on success', async () => {
    const pending = { status: 'pending', deviceSerial: 'SN1', save: jest.fn().mockResolvedValue(undefined) };
    DahuaPendingBind.findById.mockResolvedValue(pending);
    Client.findOne.mockResolvedValue({ _id: 'c1' });
    dahua.setActivationStatus.mockResolvedValue(undefined);
    Camera.create.mockResolvedValue({ _id: 'cam1' });
    const res = mockRes();

    await resolveHandler({ params: { id: 'pb1' }, body: { clientRef: 'c1', name: 'Front Gate', location: 'Driveway' } }, res);

    expect(dahua.setActivationStatus).toHaveBeenCalledWith(['SN1'], 1);
    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({
      clientRef: 'c1', name: 'Front Gate', location: 'Driveway', deviceSerial: 'SN1', streamProvider: 'dahua',
    }));
    expect(pending.status).toBe('resolved');
    expect(pending.resolvedCameraRef).toBe('cam1');
    expect(res.json).toHaveBeenCalledWith({ ok: true, cameraId: 'cam1' });
  });

  test('falls back to a device-serial-based name when none is supplied', async () => {
    const pending = { status: 'pending', deviceSerial: 'SN1', save: jest.fn().mockResolvedValue(undefined) };
    DahuaPendingBind.findById.mockResolvedValue(pending);
    Client.findOne.mockResolvedValue({ _id: 'c1' });
    dahua.setActivationStatus.mockResolvedValue(undefined);
    Camera.create.mockResolvedValue({ _id: 'cam1' });

    await resolveHandler({ params: { id: 'pb1' }, body: { clientRef: 'c1' } }, mockRes());

    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Device SN1' }));
  });
});

describe('POST /:id/ignore', () => {
  test('404s when the pending bind does not exist or is already resolved', async () => {
    DahuaPendingBind.findById.mockResolvedValue(null);
    const res = mockRes();
    await ignoreHandler({ params: { id: 'pb1' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('marks a pending bind as ignored', async () => {
    const pending = { status: 'pending', save: jest.fn().mockResolvedValue(undefined) };
    DahuaPendingBind.findById.mockResolvedValue(pending);
    const res = mockRes();

    await ignoreHandler({ params: { id: 'pb1' } }, res);

    expect(pending.status).toBe('ignored');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
