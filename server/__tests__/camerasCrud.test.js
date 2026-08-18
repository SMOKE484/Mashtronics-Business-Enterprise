'use strict';
jest.mock('../models/Camera', () => ({ create: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../services/deviceCredentials', () => ({ encryptCredentials: jest.fn() }));

const Camera = require('../models/Camera');
const { encryptCredentials } = require('../services/deviceCredentials');
const { createHandler, updateHandler, credentialsHandler } = require('../routes/cameras');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/cameras', () => {
  test('creates and returns the new camera', async () => {
    const camera = { _id: 'c1', name: 'Front Gate' };
    Camera.create.mockResolvedValue(camera);
    const req = { body: { name: 'Front Gate', clientRef: 'cl1' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(camera);
  });

  test('translates a duplicate-key error into a friendly message, never the raw Mongo string', async () => {
    Camera.create.mockRejectedValue({
      code: 11000,
      keyPattern: { name: 1 },
      message: 'E11000 duplicate key error collection: mashtronics.cameras index: name_1',
    });
    const req = { body: { name: 'Front Gate' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|collection:/);
    expect(error).toBe('A camera with that name already exists.');
  });

  test('translates a validation error into a friendly message', async () => {
    Camera.create.mockRejectedValue({ name: 'ValidationError', errors: { name: { message: 'Path `name` is required.' } } });
    const req = { body: {} };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Path `name` is required.' });
  });

  test('never includes credentials or streamConfig in the response, even though Camera.create() returns the full in-memory doc', async () => {
    // Regression: .create()'s returned document bypasses the schema's
    // select:false (that only applies to query-based reads), so the handler
    // must strip these fields itself.
    const camera = { _id: 'c1', name: 'Front Gate', credentials: null, streamConfig: null };
    Camera.create.mockResolvedValue(camera);
    const req = { body: { name: 'Front Gate' } };
    const res = mockRes();

    await createHandler(req, res);

    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody.credentials).toBeUndefined();
    expect(responseBody.streamConfig).toBeUndefined();
    // Express's res.json() -> JSON.stringify drops undefined-valued keys
    // entirely, so this is what actually reaches the wire.
    expect(JSON.stringify(responseBody)).not.toMatch(/"credentials"|"streamConfig"/);
  });
});

describe('PUT /api/cameras/:id', () => {
  test('updates and returns the camera', async () => {
    const updated = { _id: 'c1', name: 'Renamed' };
    Camera.findByIdAndUpdate.mockResolvedValue(updated);
    const req = { params: { id: 'c1' }, body: { name: 'Renamed' } };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test('404s when the camera does not exist', async () => {
    Camera.findByIdAndUpdate.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('never leaks a raw Mongo error message on failure', async () => {
    Camera.findByIdAndUpdate.mockRejectedValue(new Error('MongoServerError: E11000 duplicate key error'));
    const req = { params: { id: 'c1' }, body: {} };
    const res = mockRes();

    await updateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ error }] = res.json.mock.calls[0];
    expect(error).not.toMatch(/E11000|MongoServerError/);
  });
});

describe('PATCH /api/cameras/:id/credentials', () => {
  function mockCamera(overrides = {}) {
    return { _id: 'c1', name: 'Front Gate', archived: false, streamProvider: null, deviceSerial: '', save: jest.fn().mockResolvedValue(undefined), ...overrides };
  }

  test('404s when the camera does not exist', async () => {
    Camera.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: { username: 'admin', password: 'pw' } };
    const res = mockRes();

    await credentialsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('404s when the camera is archived', async () => {
    Camera.findById.mockResolvedValue(mockCamera({ archived: true }));
    const req = { params: { id: 'c1' }, body: { username: 'admin', password: 'pw' } };
    const res = mockRes();

    await credentialsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects when username or password is missing', async () => {
    Camera.findById.mockResolvedValue(mockCamera());
    const req = { params: { id: 'c1' }, body: { username: 'admin' } };
    const res = mockRes();

    await credentialsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(encryptCredentials).not.toHaveBeenCalled();
  });

  test('encrypts and saves credentials, flips streamProvider to dahua when deviceSerial is present, and never returns the plaintext or ciphertext', async () => {
    const camera = mockCamera({ deviceSerial: 'SN123' });
    Camera.findById.mockResolvedValue(camera);
    encryptCredentials.mockReturnValue({ iv: 'iv', authTag: 'tag', ciphertext: 'cipher', encryptedAt: 'now' });
    const req = { params: { id: 'c1' }, body: { username: 'admin', password: 'hunter2' } };
    const res = mockRes();

    await credentialsHandler(req, res);

    expect(encryptCredentials).toHaveBeenCalledWith({ username: 'admin', password: 'hunter2' });
    expect(camera.credentials).toEqual({ iv: 'iv', authTag: 'tag', ciphertext: 'cipher', encryptedAt: 'now' });
    expect(camera.streamProvider).toBe('dahua');
    expect(camera.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, streamProvider: 'dahua' });

    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody).not.toHaveProperty('credentials');
    expect(JSON.stringify(responseBody)).not.toMatch(/hunter2|cipher/);
  });

  test('does not flip streamProvider when no deviceSerial is on file', async () => {
    const camera = mockCamera({ deviceSerial: '' });
    Camera.findById.mockResolvedValue(camera);
    encryptCredentials.mockReturnValue({ iv: 'iv', authTag: 'tag', ciphertext: 'cipher', encryptedAt: 'now' });
    const req = { params: { id: 'c1' }, body: { username: 'admin', password: 'hunter2' } };
    const res = mockRes();

    await credentialsHandler(req, res);

    expect(camera.streamProvider).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ ok: true, streamProvider: null });
  });

  test('does not override an already-set streamProvider', async () => {
    const camera = mockCamera({ deviceSerial: 'SN123', streamProvider: 'dahua' });
    Camera.findById.mockResolvedValue(camera);
    encryptCredentials.mockReturnValue({ iv: 'iv', authTag: 'tag', ciphertext: 'cipher', encryptedAt: 'now' });
    const req = { params: { id: 'c1' }, body: { username: 'admin', password: 'hunter2' } };
    const res = mockRes();

    await credentialsHandler(req, res);

    expect(camera.streamProvider).toBe('dahua');
  });
});
