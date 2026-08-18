'use strict';
jest.mock('../services/dahuaAuth', () => ({ signedRequest: jest.fn() }));
jest.mock('node-fetch', () => jest.fn());

const dahuaAuth = require('../services/dahuaAuth');
const fetch     = require('node-fetch');
const { getLiveStreamSession } = require('../services/dahua');

// Minimal shape of a node-fetch response for the OSS readiness probe.
const ossResponse = status => ({ ok: status >= 200 && status < 300, status, buffer: async () => Buffer.alloc(1) });
const { getLiveViewSession, getSnapshotUrl, getPlaybackSession, listDeviceDetails } = require('../services/dahua');

const UNCONFIGURED = { streamProvider: null, deviceSerial: '', channelId: null };
const PARTIAL = { streamProvider: 'dahua', deviceSerial: '', channelId: 0 };
// A device-level row (channelId: null) — the whole NVR, not one feed — is
// not individually streamable even with a real deviceSerial.
const DEVICE_LEVEL = { streamProvider: 'dahua', deviceSerial: 'SN123', channelId: null };
const CONFIGURED = { streamProvider: 'dahua', deviceSerial: 'SN123', channelId: 0 };

beforeEach(() => jest.clearAllMocks());

describe('services/dahua', () => {
  test.each([
    ['getLiveViewSession', getLiveViewSession],
    ['getSnapshotUrl', getSnapshotUrl],
    ['getPlaybackSession', getPlaybackSession],
    ['getLiveStreamSession', getLiveStreamSession],
  ])('%s returns not_configured for a camera with no streamProvider', async (_name, fn) => {
    expect(await fn(UNCONFIGURED)).toEqual({ status: 'not_configured' });
    expect(dahuaAuth.signedRequest).not.toHaveBeenCalled();
  });

  test.each([
    ['getLiveViewSession', getLiveViewSession],
    ['getSnapshotUrl', getSnapshotUrl],
    ['getPlaybackSession', getPlaybackSession],
  ])('%s returns not_configured for a camera missing deviceSerial (partial config)', async (_name, fn) => {
    expect(await fn(PARTIAL)).toEqual({ status: 'not_configured' });
  });

  test.each([
    ['getLiveViewSession', getLiveViewSession],
    ['getSnapshotUrl', getSnapshotUrl],
    ['getLiveStreamSession', getLiveStreamSession],
  ])('%s returns not_configured for a device-level row (channelId null) — only imported channels are streamable', async (_name, fn) => {
    expect(await fn(DEVICE_LEVEL)).toEqual({ status: 'not_configured' });
    expect(dahuaAuth.signedRequest).not.toHaveBeenCalled();
  });

  test('getPlaybackSession returns an unavailable result once fully configured, since recorded playback is roadmap, not built yet', async () => {
    const result = await getPlaybackSession(CONFIGURED, { start: '2026-01-01', end: '2026-01-02' });
    expect(result.status).toBe('unavailable');
  });

  describe('getSnapshotUrl (real — setDeviceSnapEnhanced)', () => {
    test('calls Dahua with the device serial and channel id, requiring the UserAccessToken', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'https://example.com/snap.jpg' });
      fetch.mockResolvedValue(ossResponse(206));

      const result = await getSnapshotUrl(CONFIGURED);

      expect(dahuaAuth.signedRequest).toHaveBeenCalledWith(
        '/open-api/api-converter/device/setDeviceSnapEnhanced',
        { deviceId: 'SN123', channelId: '0' },
        { requireUserToken: true }
      );
      expect(result).toEqual({ status: 'ready', url: 'https://example.com/snap.jpg' });
    });

    test('probes the OSS URL with a 1-byte Range GET before reporting ready (never HEAD — OSS signs the verb)', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'https://example.com/snap.jpg' });
      fetch.mockResolvedValue(ossResponse(206));

      await getSnapshotUrl(CONFIGURED);

      expect(fetch).toHaveBeenCalledWith('https://example.com/snap.jpg', { headers: { Range: 'bytes=0-0' } });
    });

    test('waits out the OSS upload race — 404 at first, ready once the image lands', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'https://example.com/snap.jpg' });
      fetch
        .mockResolvedValueOnce(ossResponse(404))
        .mockResolvedValueOnce(ossResponse(206));

      const result = await getSnapshotUrl(CONFIGURED);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ status: 'ready', url: 'https://example.com/snap.jpg' });
    });

    test('returns unavailable when the snapshot never becomes fetchable within the budget (upload never landed)', async () => {
      jest.useFakeTimers();
      try {
        dahuaAuth.signedRequest.mockResolvedValue({ url: 'https://example.com/snap.jpg' });
        fetch.mockResolvedValue(ossResponse(404));

        const promise = getSnapshotUrl(CONFIGURED);
        await jest.advanceTimersByTimeAsync(11_000);
        const result = await promise;

        expect(result).toEqual({ status: 'unavailable', reason: 'Snapshot could not be captured. Try again shortly.' });
      } finally {
        jest.useRealTimers();
      }
    });

    test('a transient network error while probing keeps polling rather than failing instantly', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'https://example.com/snap.jpg' });
      fetch
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValueOnce(ossResponse(206));

      const result = await getSnapshotUrl(CONFIGURED);

      expect(result.status).toBe('ready');
    });

    test('returns unavailable with a friendly reason on a Dahua failure, never the raw error', async () => {
      dahuaAuth.signedRequest.mockRejectedValue(new Error('Dahua API ... failed: BIZ084 Device not activated'));

      const result = await getSnapshotUrl(CONFIGURED);

      expect(result.status).toBe('unavailable');
      expect(result.reason).not.toMatch(/BIZ084/);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('getLiveStreamSession (real streaming — createDeviceStreamUrl)', () => {
    test('requests a live RTSP stream for the channel, sub stream by default, requiring the UserAccessToken', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'rtsp://proxy.example.com:8556/abc?expire=1&digest=x' });

      const result = await getLiveStreamSession(CONFIGURED);

      expect(dahuaAuth.signedRequest).toHaveBeenCalledWith(
        '/open-api/api-converter/device/createDeviceStreamUrl',
        {
          deviceId: 'SN123',
          channelId: 0,
          businessType: 'real',
          encryptMode: 0,
          protoType: 'rtsp',
          streamType: 1,
          deviceType: 'channel',
        },
        { requireUserToken: true }
      );
      expect(result).toEqual({
        status: 'ready',
        url: 'rtsp://proxy.example.com:8556/abc?expire=1&digest=x',
        deviceId: 'SN123',
        channelId: '0',
        streamType: 1,
      });
      // Never probed by fetch — the RTSP URL is websocket-only, not HTTP.
      expect(fetch).not.toHaveBeenCalled();
    });

    test('honours an explicit main-stream request', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'rtsp://proxy.example.com:8556/abc' });

      const result = await getLiveStreamSession(CONFIGURED, { streamType: 0 });

      expect(dahuaAuth.signedRequest.mock.calls[0][1].streamType).toBe(0);
      expect(result.streamType).toBe(0);
    });

    test('returns unavailable with a friendly reason on a Dahua failure, never the raw error', async () => {
      dahuaAuth.signedRequest.mockRejectedValue(new Error('Dahua API ... failed: BIZ084 Device not activated'));

      const result = await getLiveStreamSession(CONFIGURED);

      expect(result.status).toBe('unavailable');
      expect(result.reason).not.toMatch(/BIZ084/);
    });

    test('returns unavailable when Dahua responds without a url', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({});

      const result = await getLiveStreamSession(CONFIGURED);

      expect(result).toEqual({ status: 'unavailable', reason: 'Live stream could not be started. Try again shortly.' });
    });
  });

  describe('getLiveViewSession (real — delegates to the same snapshot call)', () => {
    test('is exactly a snapshot for this phase (no relay/RTSP involved)', async () => {
      dahuaAuth.signedRequest.mockResolvedValue({ url: 'https://example.com/snap.jpg' });
      fetch.mockResolvedValue(ossResponse(200));

      const result = await getLiveViewSession(CONFIGURED);

      expect(dahuaAuth.signedRequest).toHaveBeenCalledWith(
        '/open-api/api-converter/device/setDeviceSnapEnhanced',
        { deviceId: 'SN123', channelId: '0' },
        { requireUserToken: true }
      );
      expect(result).toEqual({ status: 'ready', url: 'https://example.com/snap.jpg' });
    });

    test('returns unavailable with a friendly reason on a Dahua failure', async () => {
      dahuaAuth.signedRequest.mockRejectedValue(new Error('network blip'));

      const result = await getLiveViewSession(CONFIGURED);

      expect(result).toEqual({ status: 'unavailable', reason: expect.any(String) });
    });
  });
});

describe('listDeviceDetails', () => {
  beforeEach(() => jest.clearAllMocks());

  test('requires the UserAccessToken, mirroring setActivationStatus', async () => {
    dahuaAuth.signedRequest.mockResolvedValue({ deviceList: [{ deviceModel: 'DH-NVR', catalog: 'NVR', channels: [] }] });

    await listDeviceDetails('SN123');

    expect(dahuaAuth.signedRequest).toHaveBeenCalledWith(
      '/open-api/api-converter/device/listDeviceDetailsByIds',
      { deviceList: [{ deviceId: 'SN123' }] },
      { requireUserToken: true }
    );
  });

  test('parses and casts a multi-channel response, matching the real NVR shape proven live', async () => {
    dahuaAuth.signedRequest.mockResolvedValue({
      deviceList: [{
        deviceModel: 'DHI-NVR5232-EI',
        catalog: 'NVR',
        channels: [
          { channelId: '0', channelName: 'ADMIN RECEPTION', channelStatus: 'online', channelAbility: 'PTZ,AudioTalk,SMD' },
          { channelId: '1', channelName: 'MAIN ENTRY', channelStatus: 'offline', channelAbility: '' },
        ],
      }],
    });

    const result = await listDeviceDetails('BD10A23PAJF6096');

    expect(result).toEqual({
      deviceModel: 'DHI-NVR5232-EI',
      catalog: 'NVR',
      channels: [
        { channelId: 0, name: 'ADMIN RECEPTION', status: 'online', ability: 'PTZ,AudioTalk,SMD' },
        { channelId: 1, name: 'MAIN ENTRY', status: 'offline', ability: '' },
      ],
    });
  });

  test('falls back to a generated name when Dahua omits channelName', async () => {
    dahuaAuth.signedRequest.mockResolvedValue({
      deviceList: [{ deviceModel: '', catalog: 'IPC', channels: [{ channelId: '0', channelStatus: 'online' }] }],
    });

    const result = await listDeviceDetails('SN123');

    expect(result.channels[0].name).toBe('Channel 0');
  });

  test('throws when Dahua returns no matching device (e.g. unknown/unbound serial)', async () => {
    dahuaAuth.signedRequest.mockResolvedValue({ deviceList: [] });

    await expect(listDeviceDetails('UNKNOWN')).rejects.toThrow('Dahua returned no details for that device.');
  });

  test('propagates a Dahua-side failure (e.g. BIZ084 device not activated) as a thrown error', async () => {
    dahuaAuth.signedRequest.mockRejectedValue(new Error('Dahua API https://x/... failed: BIZ084 Device not activated'));

    await expect(listDeviceDetails('SN123')).rejects.toThrow('BIZ084');
  });
});
