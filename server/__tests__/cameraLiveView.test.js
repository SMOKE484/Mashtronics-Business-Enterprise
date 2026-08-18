'use strict';
jest.mock('../models/Camera', () => ({ findById: jest.fn() }));
jest.mock('../services/dahua', () => ({ getLiveViewSession: jest.fn(), getLiveStreamSession: jest.fn() }));
jest.mock('../services/deviceCredentials', () => ({ encryptCredentials: jest.fn() }));
jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const Camera = require('../models/Camera');
const dahua = require('../services/dahua');
const { liveViewHandler, liveStreamHandler, liveViewImageHandler } = require('../routes/cameras');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/cameras/:id/live', () => {
  test('404s when the camera does not exist', async () => {
    Camera.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(dahua.getLiveViewSession).not.toHaveBeenCalled();
  });

  test('404s when the camera is archived', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: true, streamProvider: 'dahua' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns hasLiveView:false without calling dahua when the camera has no streamProvider', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: null });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(dahua.getLiveViewSession).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns hasLiveView:false when dahua reports not_configured (e.g. a device-level row)', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'not_configured' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns a 503 with a human reason when dahua reports unavailable', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'unavailable', reason: 'Snapshot could not be captured. Try again shortly.' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      hasLiveView: true,
      available: false,
      reason: 'Snapshot could not be captured. Try again shortly.',
      error: 'Snapshot could not be captured. Try again shortly.',
    });
  });

  test('returns available:true with the session payload when dahua reports ready', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://example.com/snap.jpg' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ hasLiveView: true, available: true, url: 'https://example.com/snap.jpg' });
    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody).not.toHaveProperty('status');
  });

  test('never includes credentials in any response', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua', credentials: { iv: 'x', authTag: 'y', ciphertext: 'z' } });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://example.com/snap.jpg' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody).not.toHaveProperty('credentials');
  });

  test('responds with a generic 500 if something throws unexpectedly', async () => {
    Camera.findById.mockImplementation(() => { throw new Error('boom'); });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});

// Real streaming live view — same three-outcome contract as /live, but
// backed by getLiveStreamSession (createDeviceStreamUrl) instead of a snapshot.
describe('GET /api/cameras/:id/live-stream', () => {
  test('404s when the camera does not exist or is archived', async () => {
    Camera.findById.mockResolvedValue(null);
    const res = mockRes();
    await liveStreamHandler({ params: { id: 'missing' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);

    Camera.findById.mockResolvedValue({ _id: 'c1', archived: true, streamProvider: 'dahua' });
    const res2 = mockRes();
    await liveStreamHandler({ params: { id: 'c1' } }, res2);
    expect(res2.status).toHaveBeenCalledWith(404);
    expect(dahua.getLiveStreamSession).not.toHaveBeenCalled();
  });

  test('returns hasLiveView:false without calling dahua when the camera has no streamProvider', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: null });
    const res = mockRes();

    await liveStreamHandler({ params: { id: 'c1' } }, res);

    expect(dahua.getLiveStreamSession).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns hasLiveView:false when dahua reports not_configured (e.g. a device-level row)', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveStreamSession.mockResolvedValue({ status: 'not_configured' });
    const res = mockRes();

    await liveStreamHandler({ params: { id: 'c1' } }, res);

    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns a 503 with a human reason when dahua reports unavailable', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveStreamSession.mockResolvedValue({ status: 'unavailable', reason: 'Live stream could not be started. Try again shortly.' });
    const res = mockRes();

    await liveStreamHandler({ params: { id: 'c1' } }, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      hasLiveView: true,
      available: false,
      reason: 'Live stream could not be started. Try again shortly.',
      error: 'Live stream could not be started. Try again shortly.',
    });
  });

  test('returns available:true with the full stream payload when dahua reports ready', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveStreamSession.mockResolvedValue({
      status: 'ready',
      url: 'rtsp://proxy.example.com:8556/abc',
      deviceId: 'SN123',
      channelId: '1',
      streamType: 1,
    });
    const res = mockRes();

    await liveStreamHandler({ params: { id: 'c1' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      hasLiveView: true,
      available: true,
      url: 'rtsp://proxy.example.com:8556/abc',
      deviceId: 'SN123',
      channelId: '1',
      streamType: 1,
    });
    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody).not.toHaveProperty('status');
  });

  test('responds with a generic 500 if something throws unexpectedly', async () => {
    Camera.findById.mockImplementation(() => { throw new Error('boom'); });
    const res = mockRes();

    await liveStreamHandler({ params: { id: 'c1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});

describe('GET /api/cameras/:id/live/image', () => {
  test('404s when the camera does not exist', async () => {
    Camera.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(dahua.getLiveViewSession).not.toHaveBeenCalled();
  });

  test('404s with a message when dahua reports not_configured', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'not_configured' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('503s with the reason when dahua reports unavailable', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'unavailable', reason: 'Snapshot could not be captured. Try again shortly.' });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Snapshot could not be captured. Try again shortly.' });
  });

  test('502s when the OSS fetch itself throws', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://oss.example.com/snap.jpg' });
    fetch.mockRejectedValue(new Error('network blip'));
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  test('502s when the OSS fetch returns a non-ok status', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://oss.example.com/snap.jpg' });
    fetch.mockResolvedValue({ ok: false, status: 403 });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  test('streams the image bytes back with an explicit image/jpeg Content-Type, regardless of what OSS sent', async () => {
    Camera.findById.mockResolvedValue({ _id: 'c1', archived: false, streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://oss.example.com/snap.jpg' });
    const fakeBuffer = Buffer.from('fake-jpeg-bytes');
    fetch.mockResolvedValue({ ok: true, buffer: () => Promise.resolve(fakeBuffer) });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.send).toHaveBeenCalledWith(fakeBuffer);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('responds with a generic 500 if something throws unexpectedly', async () => {
    Camera.findById.mockImplementation(() => { throw new Error('boom'); });
    const req = { params: { id: 'c1' } };
    const res = mockRes();

    await liveViewImageHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
