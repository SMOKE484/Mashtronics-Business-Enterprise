'use strict';

// requireClientAuth (imported by routes/appCameras, unused by these handler
// tests directly) pulls in jwks-rsa -> jose, an ESM package Jest can't parse
// without transforming node_modules — mock it out, same as appMessages.test.js.
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));
jest.mock('../models/Camera', () => ({ findOne: jest.fn() }));
jest.mock('../services/dahua', () => ({ getLiveViewSession: jest.fn(), getLiveStreamSession: jest.fn() }));

const Camera = require('../models/Camera');
const dahua = require('../services/dahua');
const { streamHandler, liveStreamHandler } = require('../routes/appCameras');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function mockFindOneResult(result) {
  Camera.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(result) });
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/app/cameras/:id/stream', () => {
  test('404s when the camera does not exist for this client (or belongs to another client)', async () => {
    mockFindOneResult(null);
    const req = { params: { id: 'foreign' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    expect(Camera.findOne).toHaveBeenCalledWith({ _id: 'foreign', clientRef: 'client1', archived: false });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    expect(dahua.getLiveViewSession).not.toHaveBeenCalled();
  });

  test('returns hasLiveView:false without calling dahua when the camera has no streamProvider', async () => {
    mockFindOneResult({ _id: 'c1', streamProvider: null });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    expect(dahua.getLiveViewSession).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns hasLiveView:false when dahua reports not_configured', async () => {
    mockFindOneResult({ _id: 'c1', streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'not_configured' });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns a 503 with a human reason when dahua reports unavailable', async () => {
    mockFindOneResult({ _id: 'c1', streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'unavailable', reason: 'Live view is not yet available for this camera.' });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      hasLiveView: true,
      available: false,
      reason: 'Live view is not yet available for this camera.',
      error: 'Live view is not yet available for this camera.',
    });
  });

  test('returns available:true with the session payload when dahua reports ready', async () => {
    mockFindOneResult({ _id: 'c1', streamProvider: 'dahua' });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://example.com/stream' });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ hasLiveView: true, available: true, url: 'https://example.com/stream' });
    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody).not.toHaveProperty('status');
  });

  test('never includes credentials in any response', async () => {
    mockFindOneResult({ _id: 'c1', streamProvider: 'dahua', credentials: { iv: 'x', authTag: 'y', ciphertext: 'z' } });
    dahua.getLiveViewSession.mockResolvedValue({ status: 'ready', url: 'https://example.com/stream' });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    const [responseBody] = res.json.mock.calls[0];
    expect(responseBody).not.toHaveProperty('credentials');
  });

  test('responds with a generic 500 if something throws unexpectedly', async () => {
    Camera.findOne.mockImplementation(() => { throw new Error('boom'); });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await streamHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});

// Real streaming live view — same three-outcome contract as /stream, but
// backed by getLiveStreamSession (createDeviceStreamUrl) instead of a snapshot.
describe('GET /api/app/cameras/:id/live-stream', () => {
  test('404s when the camera does not exist for this client (or belongs to another client)', async () => {
    Camera.findOne.mockResolvedValue(null);
    const req = { params: { id: 'foreign' }, client: { _id: 'client1' } };
    const res = mockRes();

    await liveStreamHandler(req, res);

    expect(Camera.findOne).toHaveBeenCalledWith({ _id: 'foreign', clientRef: 'client1', archived: false });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(dahua.getLiveStreamSession).not.toHaveBeenCalled();
  });

  test('returns hasLiveView:false without calling dahua when the camera has no streamProvider', async () => {
    Camera.findOne.mockResolvedValue({ _id: 'c1', streamProvider: null });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await liveStreamHandler(req, res);

    expect(dahua.getLiveStreamSession).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns hasLiveView:false when dahua reports not_configured', async () => {
    Camera.findOne.mockResolvedValue({ _id: 'c1', streamProvider: 'dahua' });
    dahua.getLiveStreamSession.mockResolvedValue({ status: 'not_configured' });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await liveStreamHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ hasLiveView: false });
  });

  test('returns a 503 with a human reason when dahua reports unavailable', async () => {
    Camera.findOne.mockResolvedValue({ _id: 'c1', streamProvider: 'dahua' });
    dahua.getLiveStreamSession.mockResolvedValue({ status: 'unavailable', reason: 'Live stream could not be started. Try again shortly.' });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await liveStreamHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      hasLiveView: true,
      available: false,
      reason: 'Live stream could not be started. Try again shortly.',
      error: 'Live stream could not be started. Try again shortly.',
    });
  });

  test('returns available:true with the full stream payload when dahua reports ready', async () => {
    Camera.findOne.mockResolvedValue({ _id: 'c1', streamProvider: 'dahua' });
    dahua.getLiveStreamSession.mockResolvedValue({
      status: 'ready',
      url: 'rtsp://proxy.example.com:8556/abc',
      deviceId: 'SN123',
      channelId: '1',
      streamType: 1,
    });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await liveStreamHandler(req, res);

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
    Camera.findOne.mockImplementation(() => { throw new Error('boom'); });
    const req = { params: { id: 'c1' }, client: { _id: 'client1' } };
    const res = mockRes();

    await liveStreamHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
