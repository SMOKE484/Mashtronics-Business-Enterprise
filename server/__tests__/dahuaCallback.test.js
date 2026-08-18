'use strict';
jest.mock('../models/Camera', () => ({ findOne: jest.fn() }));
jest.mock('../models/Client', () => ({ findOne: jest.fn() }));
jest.mock('../models/DahuaEventLog', () => ({ create: jest.fn() }));
jest.mock('../models/DahuaPendingBind', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../services/dahua', () => ({ ackMessage: jest.fn(), setActivationStatus: jest.fn() }));
jest.mock('../services/realtime', () => ({ publish: jest.fn(), broadcastToAdmins: jest.fn() }));

const Camera           = require('../models/Camera');
const Client            = require('../models/Client');
const DahuaEventLog    = require('../models/DahuaEventLog');
const DahuaPendingBind = require('../models/DahuaPendingBind');
const dahua             = require('../services/dahua');
const realtime           = require('../services/realtime');
const { callbackHandler } = require('../routes/dahuaCallback');

const TOKEN = 'test-callback-token';

function mockReq({ token = TOKEN, body = {}, rawBody } = {}) {
  return { params: { token }, body, rawBody };
}
function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DAHUA_CALLBACK_TOKEN = TOKEN;
  delete process.env.DAHUA_ARC_COMPANY_ID;
  DahuaEventLog.create.mockResolvedValue({});
  dahua.ackMessage.mockResolvedValue(undefined);
  realtime.publish.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.DAHUA_CALLBACK_TOKEN;
});

describe('token gating', () => {
  test('rejects a wrong token with a plain 404, touching no models', async () => {
    const res = mockRes();
    await callbackHandler(mockReq({ token: 'wrong' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(DahuaEventLog.create).not.toHaveBeenCalled();
  });

  test('rejects when DAHUA_CALLBACK_TOKEN is not configured at all', async () => {
    delete process.env.DAHUA_CALLBACK_TOKEN;
    const res = mockRes();
    await callbackHandler(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('payload validation', () => {
  test('400s on a body missing msgType/id', async () => {
    const res = mockRes();
    await callbackHandler(mockReq({ body: { deviceId: 'SN1' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ignores (200) an event addressed to a different companyId', async () => {
    process.env.DAHUA_ARC_COMPANY_ID = '111';
    const res = mockRes();
    await callbackHandler(mockReq({ body: { id: 1, msgType: 'online', deviceId: 'SN1', companyId: 222 } }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ignored: true }));
    expect(DahuaEventLog.create).not.toHaveBeenCalled();
  });
});

describe('big-integer id/companyId precision (JSON.parse silently rounds 19-digit values)', () => {
  // Real shape from the 2026-08-01 session: this exact companyId, run
  // through JSON.parse, becomes 1685825282387133200 — a different number.
  const REAL_COMPANY_ID = '1685825282387133305';
  const REAL_MESSAGE_ID = '1877342452898066432';

  test('extracts the exact id/companyId from rawBody instead of the JSON.parse-corrupted body', async () => {
    process.env.DAHUA_ARC_COMPANY_ID = REAL_COMPANY_ID;
    Camera.findOne.mockResolvedValue(null);
    // The exact bytes Dahua would actually send — the same shape express.json's
    // `verify` hook stashes on req.rawBody before JSON.parse ever touches it.
    const rawBody = Buffer.from(`{"id":${REAL_MESSAGE_ID},"msgType":"offline","deviceId":"SN1","companyId":${REAL_COMPANY_ID}}`);
    // req.body is what JSON.parse actually hands the handler — already lossy,
    // exactly reproducing the live bug (1685825282387133305 -> ...133200).
    const body = JSON.parse(rawBody.toString());
    const res = mockRes();

    await callbackHandler(mockReq({ body, rawBody }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ ignored: true })); // companyId matched exactly
    expect(dahua.ackMessage).toHaveBeenCalledWith(REAL_MESSAGE_ID); // exact id, not the rounded one
    delete process.env.DAHUA_ARC_COMPANY_ID;
  });

  test('without a rawBody, falls back to the (lossy) parsed value — documents the fallback, not the fix', async () => {
    Camera.findOne.mockResolvedValue(null);
    const res = mockRes();
    // No rawBody supplied — simulates a caller that never wired up express.json's verify hook.
    await callbackHandler(mockReq({ body: { id: JSON.parse(REAL_MESSAGE_ID), msgType: 'offline', deviceId: 'SN1' } }), res);

    expect(dahua.ackMessage).toHaveBeenCalledWith(String(JSON.parse(REAL_MESSAGE_ID)));
    expect(dahua.ackMessage).not.toHaveBeenCalledWith(REAL_MESSAGE_ID);
  });
});

describe('idempotency', () => {
  test('a duplicate message id (11000) still 200s and still Acks, but does not reprocess', async () => {
    DahuaEventLog.create.mockRejectedValue({ code: 11000 });
    const res = mockRes();
    await callbackHandler(mockReq({ body: { id: 42, msgType: 'online', deviceId: 'SN1' } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Camera.findOne).not.toHaveBeenCalled();
    expect(dahua.ackMessage).toHaveBeenCalledWith('42');
  });

  test('a genuine DB error on the log insert 500s and skips the Ack', async () => {
    DahuaEventLog.create.mockRejectedValue(new Error('mongo down'));
    const res = mockRes();
    await callbackHandler(mockReq({ body: { id: 42, msgType: 'online', deviceId: 'SN1' } }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(dahua.ackMessage).not.toHaveBeenCalled();
  });
});

describe('online/offline processing', () => {
  test('unknown deviceId is logged only — no crash, still 200, still Acked', async () => {
    Camera.findOne.mockResolvedValue(null);
    const res = mockRes();
    await callbackHandler(mockReq({ body: { id: 1, msgType: 'offline', deviceId: 'UNKNOWN' } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(dahua.ackMessage).toHaveBeenCalledWith('1');
    expect(realtime.publish).not.toHaveBeenCalled();
  });

  test('maps deviceId+channelId to the right camera and updates status', async () => {
    const camera = { _id: 'cam1', status: 'online', save: jest.fn().mockResolvedValue(undefined), clientRef: 'client1', name: 'Cam', location: 'Gate' };
    Camera.findOne.mockResolvedValue(camera);
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 2, msgType: 'offline', deviceId: 'SN1', channelId: 3 } }), res);

    expect(Camera.findOne).toHaveBeenCalledWith({ deviceSerial: 'SN1', channelId: 3 });
    expect(camera.status).toBe('offline');
    expect(camera.save).toHaveBeenCalled();
  });

  test('publishes camera:offline only on a genuine online->offline transition', async () => {
    const camera = { _id: 'cam1', status: 'online', save: jest.fn().mockResolvedValue(undefined), clientRef: 'client1', name: 'Cam', location: 'Gate' };
    Camera.findOne.mockResolvedValue(camera);
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 3, msgType: 'offline', deviceId: 'SN1' } }), res);

    expect(realtime.publish).toHaveBeenCalledWith('client1', 'camera:offline', expect.objectContaining({ cameraId: 'cam1' }));
  });

  test('does not re-publish when the camera was already offline', async () => {
    const camera = { _id: 'cam1', status: 'offline', save: jest.fn().mockResolvedValue(undefined), clientRef: 'client1', name: 'Cam', location: 'Gate' };
    Camera.findOne.mockResolvedValue(camera);
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 4, msgType: 'offline', deviceId: 'SN1' } }), res);

    expect(realtime.publish).not.toHaveBeenCalled();
  });

  test('an online event never publishes camera:offline', async () => {
    const camera = { _id: 'cam1', status: 'offline', save: jest.fn().mockResolvedValue(undefined), clientRef: 'client1', name: 'Cam', location: 'Gate' };
    Camera.findOne.mockResolvedValue(camera);
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 5, msgType: 'online', deviceId: 'SN1' } }), res);

    expect(camera.status).toBe('online');
    expect(realtime.publish).not.toHaveBeenCalled();
  });
});

describe('bindDevice processing', () => {
  test('creates a pending bind for a new device serial and notifies admins', async () => {
    Camera.findOne.mockResolvedValue(null);
    DahuaPendingBind.findOne.mockResolvedValue(null);
    Client.findOne.mockResolvedValue(null);
    DahuaPendingBind.create.mockResolvedValue({ _id: 'pb1', ownerEmail: 'owner@example.com' });
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 6, msgType: 'bindDevice', devices: ['SN9'], ownerEmail: 'owner@example.com' } }), res);

    expect(DahuaPendingBind.create).toHaveBeenCalledWith(expect.objectContaining({ deviceSerial: 'SN9', ownerEmail: 'owner@example.com' }));
    expect(realtime.broadcastToAdmins).toHaveBeenCalledWith('dahua:pendingBind', expect.objectContaining({ deviceSerial: 'SN9' }));
  });

  test('skips a device that already has a Camera (not new-customer onboarding)', async () => {
    Camera.findOne.mockResolvedValue({ _id: 'existingCam' });
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 7, msgType: 'bindDevice', devices: ['SN9'] } }), res);

    expect(DahuaPendingBind.create).not.toHaveBeenCalled();
  });

  test('skips a device that already has an open pending-bind row (duplicate delivery)', async () => {
    Camera.findOne.mockResolvedValue(null);
    DahuaPendingBind.findOne.mockResolvedValue({ _id: 'existingPending' });
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 8, msgType: 'bindDevice', devices: ['SN9'] } }), res);

    expect(DahuaPendingBind.create).not.toHaveBeenCalled();
  });

  test('suggests a client match by owner email, never auto-assigns', async () => {
    Camera.findOne.mockResolvedValue(null);
    DahuaPendingBind.findOne.mockResolvedValue(null);
    Client.findOne.mockResolvedValue({ _id: 'client9' });
    DahuaPendingBind.create.mockResolvedValue({ _id: 'pb1', ownerEmail: 'a@b.com' });
    const res = mockRes();

    await callbackHandler(mockReq({ body: { id: 9, msgType: 'bindDevice', devices: ['SN9'], ownerEmail: 'A@B.com' } }), res);

    expect(Client.findOne).toHaveBeenCalledWith({ archived: false, $or: [{ contactEmail: 'a@b.com' }] });
    expect(DahuaPendingBind.create).toHaveBeenCalledWith(expect.objectContaining({ suggestedClientRef: 'client9' }));
  });
});

describe('unhandled msgTypes', () => {
  test('SIAEvent and other types are logged but produce no side effects', async () => {
    const res = mockRes();
    await callbackHandler(mockReq({ body: { id: 10, msgType: 'SIAEvent', deviceId: 'SN1' } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Camera.findOne).not.toHaveBeenCalled();
    expect(DahuaPendingBind.create).not.toHaveBeenCalled();
  });
});

describe('Ack resilience', () => {
  test('an Ack failure is caught and logged, never surfaces to the response', async () => {
    dahua.ackMessage.mockRejectedValue(new Error('Dahua down'));
    const res = mockRes();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await callbackHandler(mockReq({ body: { id: 11, msgType: 'SIAEvent' } }), res);
    await Promise.resolve(); // flush the fire-and-forget .catch

    expect(res.status).toHaveBeenCalledWith(200);
    errSpy.mockRestore();
  });
});
