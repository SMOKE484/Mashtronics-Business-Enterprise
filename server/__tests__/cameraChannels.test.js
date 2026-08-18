'use strict';
jest.mock('../models/Camera', () => ({ findById: jest.fn(), find: jest.fn(), create: jest.fn() }));
jest.mock('../services/dahua', () => ({ listDeviceDetails: jest.fn() }));
jest.mock('../services/deviceCredentials', () => ({ encryptCredentials: jest.fn() }));

const Camera = require('../models/Camera');
const dahua = require('../services/dahua');
const { listChannelsHandler, importChannelsHandler } = require('../routes/cameras');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/cameras/:id/channels', () => {
  test('404s when the camera does not exist', async () => {
    Camera.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await listChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('404s when the camera is archived', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: true, deviceSerial: 'SN1' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await listChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400s when the camera has no deviceSerial', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: '' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await listChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dahua.listDeviceDetails).not.toHaveBeenCalled();
  });

  test('502s with a friendly message when Dahua cannot be reached, never a raw error', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1' });
    dahua.listDeviceDetails.mockRejectedValue(new Error('Dahua API ... failed: BIZ084 Device not activated'));
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await listChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/BIZ084/);
  });

  test('flags channels already imported as their own Camera row, and leaves the rest unflagged', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1' });
    dahua.listDeviceDetails.mockResolvedValue({
      deviceModel: 'DHI-NVR5232-EI',
      catalog: 'NVR',
      channels: [
        { channelId: 0, name: 'ADMIN RECEPTION', status: 'online', ability: '' },
        { channelId: 1, name: 'MAIN ENTRY', status: 'online', ability: '' },
      ],
    });
    Camera.find.mockResolvedValue([{ channelId: 0 }, { channelId: null }]);
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await listChannelsHandler(req, res);

    expect(Camera.find).toHaveBeenCalledWith({ deviceSerial: 'SN1' }, 'channelId');
    const [body] = res.json.mock.calls[0];
    expect(body.channels).toEqual([
      { channelId: 0, name: 'ADMIN RECEPTION', status: 'online', ability: '', alreadyImported: true },
      { channelId: 1, name: 'MAIN ENTRY', status: 'online', ability: '', alreadyImported: false },
    ]);
  });
});

describe('POST /api/cameras/:id/channels/import', () => {
  test('404s when the parent camera does not exist', async () => {
    Camera.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: { channels: [{ channelId: 0, name: 'A' }] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400s when the parent camera has no deviceSerial', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: '' });
    const req = { params: { id: 'c1' }, body: { channels: [{ channelId: 0, name: 'A' }] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s when no channels are selected', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: 'Front' });
    const req = { params: { id: 'c1' }, body: { channels: [] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Camera.create).not.toHaveBeenCalled();
  });

  test('creates one Camera per selected channel, inheriting clientRef/location/deviceSerial from the parent', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: 'Front Building' });
    Camera.find.mockResolvedValue([]);
    Camera.create
      .mockResolvedValueOnce({ _id: 'ch0', name: 'ADMIN RECEPTION', channelId: 0, credentials: null, streamConfig: null })
      .mockResolvedValueOnce({ _id: 'ch1', name: 'MAIN ENTRY', channelId: 1, credentials: null, streamConfig: null });
    const req = {
      params: { id: 'c1' },
      body: { channels: [{ channelId: 0, name: 'ADMIN RECEPTION' }, { channelId: 1, name: 'MAIN ENTRY' }] },
    };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({
      clientRef: 'cl1', name: 'ADMIN RECEPTION', location: 'Front Building', deviceSerial: 'SN1', channelId: 0, streamProvider: 'dahua',
    }));
    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({ channelId: 1, name: 'MAIN ENTRY' }));
    const [{ created }] = res.json.mock.calls[0];
    expect(created).toHaveLength(2);
  });

  test('creates each channel with its real status from Dahua, not the schema offline default', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: '' });
    Camera.find.mockResolvedValue([]);
    dahua.listDeviceDetails.mockResolvedValue({
      deviceModel: 'DHI-NVR5232-EI',
      catalog: 'NVR',
      channels: [
        { channelId: 0, name: 'ADMIN RECEPTION', status: 'online', ability: '' },
        { channelId: 1, name: 'MAIN ENTRY', status: 'offline', ability: '' },
      ],
    });
    Camera.create.mockResolvedValue({ _id: 'ch', credentials: null, streamConfig: null });
    const req = {
      params: { id: 'c1' },
      body: { channels: [{ channelId: 0, name: 'ADMIN RECEPTION' }, { channelId: 1, name: 'MAIN ENTRY' }] },
    };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({ channelId: 0, status: 'online' }));
    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({ channelId: 1, status: 'offline' }));
  });

  test('falls back to offline (without blocking the import) if Dahua cannot be reached during import', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: '' });
    Camera.find.mockResolvedValue([]);
    dahua.listDeviceDetails.mockRejectedValue(new Error('network blip'));
    Camera.create.mockResolvedValue({ _id: 'ch0', credentials: null, streamConfig: null });
    const req = { params: { id: 'c1' }, body: { channels: [{ channelId: 0, name: 'ADMIN RECEPTION' }] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(Camera.create).toHaveBeenCalledWith(expect.objectContaining({ channelId: 0, status: 'offline' }));
    const [{ created }] = res.json.mock.calls[0];
    expect(created).toHaveLength(1);
  });

  test('skips a channel already imported for this deviceSerial, re-checked server-side', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: '' });
    Camera.find.mockResolvedValue([{ channelId: 0 }]);
    const req = { params: { id: 'c1' }, body: { channels: [{ channelId: 0, name: 'ADMIN RECEPTION' }] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(Camera.create).not.toHaveBeenCalled();
    const [{ created }] = res.json.mock.calls[0];
    expect(created).toEqual([]);
  });

  test('strips credentials and streamConfig off each created camera before responding', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: '' });
    Camera.find.mockResolvedValue([]);
    Camera.create.mockResolvedValue({ _id: 'ch0', name: 'A', channelId: 0, credentials: null, streamConfig: null });
    const req = { params: { id: 'c1' }, body: { channels: [{ channelId: 0, name: 'A' }] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    const [{ created }] = res.json.mock.calls[0];
    expect(JSON.stringify(created)).not.toMatch(/"credentials"|"streamConfig"/);
  });

  test('translates a duplicate-key race into a friendly message, never the raw Mongo string', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, deviceSerial: 'SN1', clientRef: 'cl1', location: '' });
    Camera.find.mockResolvedValue([]);
    Camera.create.mockRejectedValue({ code: 11000, keyPattern: { deviceSerial: 1, channelId: 1 }, message: 'E11000 duplicate key error' });
    const req = { params: { id: 'c1' }, body: { channels: [{ channelId: 0, name: 'A' }] } };
    const res = mockRes();

    await importChannelsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000/);
  });
});
