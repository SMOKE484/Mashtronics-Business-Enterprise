'use strict';
jest.mock('node-fetch');
const fetch = require('node-fetch');
const { sendExpoPush, pushToStaff } = require('../services/pushNotifications');

function mockFetchResponse({ ok = true, status = 200, json = { data: [{ status: 'ok' }] } } = {}) {
  fetch.mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(json),
    text: jest.fn().mockResolvedValue(JSON.stringify(json)),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('sendExpoPush', () => {
  test('posts to the Expo push API with the token, title, body, and data', async () => {
    mockFetchResponse();

    await sendExpoPush('ExponentPushToken[abc]', { title: 'Hi', body: 'There', data: { jobId: 'j1' } });

    expect(fetch).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({
      method: 'POST',
    }));
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toEqual({ to: 'ExponentPushToken[abc]', title: 'Hi', body: 'There', data: { jobId: 'j1' }, sound: 'default' });
  });

  test('throws when the HTTP response is not ok', async () => {
    mockFetchResponse({ ok: false, status: 500 });

    await expect(sendExpoPush('tok', { title: 'Hi' })).rejects.toThrow(/500/);
  });

  test('throws when Expo accepts the request but rejects the individual message', async () => {
    mockFetchResponse({ json: { data: [{ status: 'error', message: 'DeviceNotRegistered' }] } });

    await expect(sendExpoPush('tok', { title: 'Hi' })).rejects.toThrow(/DeviceNotRegistered/);
  });

  test('succeeds when Expo accepts the message', async () => {
    mockFetchResponse({ json: { data: [{ status: 'ok' }] } });

    await expect(sendExpoPush('tok', { title: 'Hi' })).resolves.toBeUndefined();
  });
});

describe('pushToStaff', () => {
  test('no-ops with a reason when the staff doc has no push token', async () => {
    const result = await pushToStaff({ _id: 't1', expoPushToken: null }, { title: 'Hi' });
    expect(result).toEqual({ sent: false, reason: 'No push token on file' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('no-ops when staffDoc itself is missing', async () => {
    const result = await pushToStaff(null, { title: 'Hi' });
    expect(result).toEqual({ sent: false, reason: 'No push token on file' });
  });

  test('reports success when the send succeeds', async () => {
    mockFetchResponse();
    const result = await pushToStaff({ _id: 't1', expoPushToken: 'tok' }, { title: 'Hi' });
    expect(result).toEqual({ sent: true });
  });

  test('never throws, degrades to {sent:false, reason} on failure', async () => {
    mockFetchResponse({ ok: false, status: 500 });
    const result = await pushToStaff({ _id: 't1', expoPushToken: 'tok' }, { title: 'Hi' });
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/500/);
  });
});
