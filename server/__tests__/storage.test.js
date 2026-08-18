'use strict';
jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const savedEnv = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const { createSignedUrls, objectExists, deleteObject } = require('../services/storage');

describe('createSignedUrls', () => {
  test('maps each path to a full signed URL on success', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { path: 'uid/jobs/j1/a.jpg', signedURL: '/object/sign/job-photos/uid/jobs/j1/a.jpg?token=t1' },
        { path: 'uid/jobs/j1/b.jpg', signedURL: '/object/sign/job-photos/uid/jobs/j1/b.jpg?token=t2' },
      ],
    });

    const result = await createSignedUrls(['uid/jobs/j1/a.jpg', 'uid/jobs/j1/b.jpg']);

    expect(result.get('uid/jobs/j1/a.jpg')).toBe(
      'https://test.supabase.co/storage/v1/object/sign/job-photos/uid/jobs/j1/a.jpg?token=t1'
    );
    expect(result.get('uid/jobs/j1/b.jpg')).toContain('token=t2');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('https://test.supabase.co/storage/v1/object/sign/job-photos');
    expect(JSON.parse(opts.body)).toEqual({ expiresIn: 3600, paths: ['uid/jobs/j1/a.jpg', 'uid/jobs/j1/b.jpg'] });
  });

  test('per-path failures map to null while others still sign', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { path: 'uid/jobs/j1/a.jpg', signedURL: '/signed-a' },
        { path: 'uid/jobs/j1/gone.jpg', error: 'Object not found' },
      ],
    });

    const result = await createSignedUrls(['uid/jobs/j1/a.jpg', 'uid/jobs/j1/gone.jpg']);

    expect(result.get('uid/jobs/j1/a.jpg')).toContain('/signed-a');
    expect(result.get('uid/jobs/j1/gone.jpg')).toBeNull();
  });

  test('a non-OK response yields all-null values, never throws', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    const result = await createSignedUrls(['uid/jobs/j1/a.jpg']);

    expect(result.get('uid/jobs/j1/a.jpg')).toBeNull();
  });

  test('a network failure yields all-null values, never throws', async () => {
    fetch.mockRejectedValue(new Error('offline'));

    const result = await createSignedUrls(['uid/jobs/j1/a.jpg']);

    expect(result.get('uid/jobs/j1/a.jpg')).toBeNull();
  });

  test('no-ops without Supabase env (returns nulls, no fetch)', async () => {
    delete process.env.SUPABASE_URL;

    const result = await createSignedUrls(['uid/jobs/j1/a.jpg']);

    expect(result.get('uid/jobs/j1/a.jpg')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('empty path list makes no request', async () => {
    const result = await createSignedUrls([]);
    expect(result.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('objectExists', () => {
  test('true when the info endpoint returns OK', async () => {
    fetch.mockResolvedValue({ ok: true });
    await expect(objectExists('uid/jobs/j1/a.jpg')).resolves.toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('https://test.supabase.co/storage/v1/object/info/job-photos/uid/jobs/j1/a.jpg');
  });

  test('false on 404', async () => {
    fetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(objectExists('uid/jobs/j1/missing.jpg')).resolves.toBe(false);
  });

  test('false on network failure (caller rejects the record, app retries)', async () => {
    fetch.mockRejectedValue(new Error('offline'));
    await expect(objectExists('uid/jobs/j1/a.jpg')).resolves.toBe(false);
  });

  test('false without Supabase env', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(objectExists('uid/jobs/j1/a.jpg')).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('deleteObject', () => {
  test('true on success', async () => {
    fetch.mockResolvedValue({ ok: true });
    await expect(deleteObject('uid/jobs/j1/a.jpg')).resolves.toBe(true);
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });

  test('false on failure, never throws', async () => {
    fetch.mockRejectedValue(new Error('offline'));
    await expect(deleteObject('uid/jobs/j1/a.jpg')).resolves.toBe(false);
  });
});
