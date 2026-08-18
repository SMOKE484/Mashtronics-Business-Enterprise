'use strict';
jest.mock('node-fetch');

const ENV = {
  DAHUA_ACCESS_KEY: 'ak-123',
  DAHUA_SECRET_ACCESS_KEY: 'sk-456',
  DAHUA_API_DOMAIN: 'https://open-api-test.dolynkcloud.com',
  DAHUA_PRODUCT_ID: '999',
  DAHUA_ARC_EMAIL: 'techsupport@mashtronicsbe.co.za',
  DAHUA_ARC_PASSWORD: 'plaintext-pw',
};

function withResponses(fetch, responses) {
  let call = 0;
  fetch.mockImplementation(() => {
    const json = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return Promise.resolve({ ok: true, status: 200, json: jest.fn().mockResolvedValue(json) });
  });
}

function ok(data) {
  return { code: '200', success: true, data, msg: 'Operation is successful.' };
}

// dahuaAuth caches tokens at module scope — reset the module registry between
// tests so cached tokens from one test never leak into the next.
let fetch, dahuaAuth;
beforeEach(() => {
  jest.resetModules();
  Object.entries(ENV).forEach(([k, v]) => { process.env[k] = v; });
  fetch = require('node-fetch');
  dahuaAuth = require('../services/dahuaAuth');
});

afterEach(() => {
  Object.keys(ENV).forEach(k => { delete process.env[k]; });
});

describe('config validation', () => {
  test('getAppAccessToken throws a descriptive error when an env var is missing', async () => {
    delete process.env.DAHUA_SECRET_ACCESS_KEY;
    await expect(dahuaAuth.getAppAccessToken()).rejects.toThrow(/DAHUA_SECRET_ACCESS_KEY/);
  });

  test('getUserAccessToken throws when ARC credentials are missing', async () => {
    delete process.env.DAHUA_ARC_PASSWORD;
    withResponses(fetch, [ok({ appAccessToken: 'app-tok', validitySeconds: 604800 })]);
    await expect(dahuaAuth.getUserAccessToken()).rejects.toThrow(/DAHUA_ARC_PASSWORD/);
  });
});

describe('getAppAccessToken', () => {
  test('signs with AccessKey+Timestamp+Nonce and returns the token', async () => {
    withResponses(fetch, [ok({ appAccessToken: 'app-tok-1', validitySeconds: 604800 })]);

    const token = await dahuaAuth.getAppAccessToken();

    expect(token).toBe('app-tok-1');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://open-api-test.dolynkcloud.com/open-api/api-base/auth/getAppAccessToken');
    expect(opts.headers.AccessKey).toBe('ak-123');
    expect(opts.headers.ProductId).toBe('999');
    expect(opts.headers['Sign-Type']).toBe('simple');
    expect(opts.headers.Sign).toMatch(/^[0-9A-F]{128}$/); // HMAC-SHA512 hex, uppercase
    expect(opts.headers.AppAccessToken).toBeUndefined();
  });

  test('caches the token across calls instead of re-fetching', async () => {
    withResponses(fetch, [ok({ appAccessToken: 'app-tok-1', validitySeconds: 604800 })]);

    await dahuaAuth.getAppAccessToken();
    await dahuaAuth.getAppAccessToken();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('re-fetches once the cached token is past its validity window', async () => {
    withResponses(fetch, [
      ok({ appAccessToken: 'app-tok-1', validitySeconds: 1 }), // expires almost immediately
      ok({ appAccessToken: 'app-tok-2', validitySeconds: 604800 }),
    ]);

    const first = await dahuaAuth.getAppAccessToken();
    const second = await dahuaAuth.getAppAccessToken();

    expect(first).toBe('app-tok-1');
    expect(second).toBe('app-tok-2');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('throws a descriptive error when Dahua rejects the request', async () => {
    withResponses(fetch, [{ code: 'AUT003', success: false, msg: 'Request exceeds validity period' }]);
    await expect(dahuaAuth.getAppAccessToken()).rejects.toThrow(/AUT003/);
  });
});

describe('saltedPassword', () => {
  test('matches the two-step HMAC-SHA512 recipe from the FAQ (key-first arg order, lowercase hex)', () => {
    const crypto = require('crypto');
    const content = crypto.createHmac('sha512', 'mySalt123').update('passwordPlain').digest('hex');
    const expected = crypto.createHmac('sha512', 'myRandom456').update(content).digest('hex');

    expect(dahuaAuth.saltedPassword('passwordPlain', 'mySalt123', 'myRandom456')).toBe(expected);
    expect(dahuaAuth.saltedPassword('passwordPlain', 'mySalt123', 'myRandom456')).toMatch(/^[0-9a-f]+$/);
  });
});

describe('getUserAccessToken', () => {
  test('chains getAppAccessToken -> getSalt -> login, signing login with AppAccessToken (no UserAccessToken yet)', async () => {
    withResponses(fetch, [
      ok({ appAccessToken: 'app-tok', validitySeconds: 604800 }),
      ok({ salt: 'saltval', random: 'randval' }),
      ok({ userAccessToken: 'user-tok-1', validitySeconds: 1296000 }),
    ]);

    const token = await dahuaAuth.getUserAccessToken();

    expect(token).toBe('user-tok-1');
    expect(fetch).toHaveBeenCalledTimes(3);

    const loginCall = fetch.mock.calls[2];
    expect(loginCall[0]).toBe('https://open-api-test.dolynkcloud.com/open-api/api-converter/user/login');
    expect(loginCall[1].headers.AppAccessToken).toBe('app-tok');
    expect(loginCall[1].headers.UserAccessToken).toBeUndefined();
    const loginBody = JSON.parse(loginCall[1].body);
    expect(loginBody.accountEmail).toBe('techsupport@mashtronicsbe.co.za');
    expect(loginBody.password).not.toBe('plaintext-pw'); // never sends the plaintext
  });

  test('caches the user token across calls', async () => {
    withResponses(fetch, [
      ok({ appAccessToken: 'app-tok', validitySeconds: 604800 }),
      ok({ salt: 'saltval', random: 'randval' }),
      ok({ userAccessToken: 'user-tok-1', validitySeconds: 1296000 }),
    ]);

    await dahuaAuth.getUserAccessToken();
    await dahuaAuth.getUserAccessToken();

    expect(fetch).toHaveBeenCalledTimes(3); // not 6 — second call was served from cache
  });
});

describe('signedRequest', () => {
  test('non-user-login call signs with AK+AppAccessToken+Timestamp+Nonce, no UserAccessToken', async () => {
    withResponses(fetch, [
      ok({ appAccessToken: 'app-tok', validitySeconds: 604800 }),
      ok({}),
    ]);

    await dahuaAuth.signedRequest('/open-api/api-message/notice/messageAck', { id: 123 });

    const call = fetch.mock.calls[1];
    expect(call[0]).toBe('https://open-api-test.dolynkcloud.com/open-api/api-message/notice/messageAck');
    expect(call[1].headers.AppAccessToken).toBe('app-tok');
    expect(call[1].headers.UserAccessToken).toBeUndefined();
    expect(JSON.parse(call[1].body)).toEqual({ id: 123 });
  });

  test('requireUserToken:true fetches and includes the UserAccessToken header', async () => {
    withResponses(fetch, [
      ok({ appAccessToken: 'app-tok', validitySeconds: 604800 }),
      ok({ salt: 'saltval', random: 'randval' }),
      ok({ userAccessToken: 'user-tok', validitySeconds: 1296000 }),
      ok({}),
    ]);

    await dahuaAuth.signedRequest('/open-api/api-converter/device/setActivationStatus', { deviceIds: ['SN1'], activationStatus: 1 }, { requireUserToken: true });

    const call = fetch.mock.calls[3];
    expect(call[1].headers.AppAccessToken).toBe('app-tok');
    expect(call[1].headers.UserAccessToken).toBe('user-tok');
  });

  test('throws a descriptive error on a non-ok HTTP response', async () => {
    fetch.mockImplementation((url) => {
      if (url.endsWith('/getAppAccessToken')) {
        return Promise.resolve({ ok: true, status: 200, json: jest.fn().mockResolvedValue(ok({ appAccessToken: 'app-tok', validitySeconds: 604800 })) });
      }
      return Promise.resolve({ ok: false, status: 500, json: jest.fn().mockResolvedValue(null) });
    });

    await expect(dahuaAuth.signedRequest('/open-api/api-message/notice/messageAck', { id: 1 })).rejects.toThrow(/500/);
  });
});
