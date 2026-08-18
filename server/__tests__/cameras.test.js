'use strict';
const { toAppCamera } = require('../services/cameras');

const baseCamera = {
  _id: '652f1a2b3c4d5e6f7a8b9c0d',
  clientRef: '652f1a2b3c4d5e6f7a8b9c00',
  name: 'Front gate',
  location: 'Driveway entry',
  model: 'Dahua IPC-HFW',
  status: 'online',
  signal: 'Strong',
  streamProvider: null,
  archived: false,
};

describe('toAppCamera', () => {
  test('shapes a camera doc to the app-facing fields only', () => {
    expect(toAppCamera(baseCamera)).toEqual({
      id: '652f1a2b3c4d5e6f7a8b9c0d',
      name: 'Front gate',
      location: 'Driveway entry',
      model: 'Dahua IPC-HFW',
      status: 'online',
      signal: 'Strong',
      hasLiveView: false,
    });
  });

  test('hasLiveView is true when a streamProvider is set', () => {
    const out = toAppCamera({ ...baseCamera, streamProvider: 'rtsp-relay' });
    expect(out.hasLiveView).toBe(true);
  });

  test('never exposes clientRef, streamConfig, or archived', () => {
    const out = toAppCamera({ ...baseCamera, streamConfig: { rtspUrl: 'rtsp://secret' } });
    expect(out).not.toHaveProperty('clientRef');
    expect(out).not.toHaveProperty('streamConfig');
    expect(out).not.toHaveProperty('archived');
  });
});
