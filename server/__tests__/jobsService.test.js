'use strict';
jest.mock('../services/storage', () => ({ createSignedUrls: jest.fn() }));
const { createSignedUrls } = require('../services/storage');
const { mapAppStatus, durationMinutes, toAppJob } = require('../services/jobs');

beforeEach(() => jest.clearAllMocks());

describe('mapAppStatus', () => {
  test('maps all four admin statuses to the app vocabulary', () => {
    expect(mapAppStatus('Scheduled')).toBe('upcoming');
    expect(mapAppStatus('In Progress')).toBe('in-progress');
    expect(mapAppStatus('Completed')).toBe('done');
    expect(mapAppStatus('Cancelled')).toBe('cancelled');
  });

  test('unknown status degrades to upcoming', () => {
    expect(mapAppStatus('Whatever')).toBe('upcoming');
  });
});

describe('durationMinutes', () => {
  test('rounds to whole minutes', () => {
    expect(durationMinutes(new Date('2026-07-12T08:00:00Z'), new Date('2026-07-12T09:20:30Z'))).toBe(81);
  });

  test('null when either timestamp is missing', () => {
    expect(durationMinutes(null, new Date())).toBeNull();
    expect(durationMinutes(new Date(), null)).toBeNull();
    expect(durationMinutes(null, null)).toBeNull();
  });

  test('null when completed before started (bad data guard)', () => {
    expect(durationMinutes(new Date('2026-07-12T10:00:00Z'), new Date('2026-07-12T09:00:00Z'))).toBeNull();
  });
});

describe('toAppJob', () => {
  function baseJob(overrides = {}) {
    return {
      _id: 'job-1',
      jobNumber: 'J100',
      status: 'Scheduled',
      scheduledDate: new Date('2026-07-12T07:00:00Z'),
      scheduledTime: '09:00',
      clientRef: { name: 'Tumi Mokoena', billingAddress: '12 Acacia Rd, Sandton', contactPhone: '+27 82 000 0000', supabaseUserId: 'should-never-leak' },
      site: '',
      jobType: 'CCTV install',
      priority: 'Medium',
      notes: '2x IP camera install',
      checklist: [{ label: 'Mount cameras', done: false }],
      parts: ['Cat6 cable'],
      photos: [],
      signature: null,
      startedAt: null,
      completedAt: null,
      ...overrides,
    };
  }

  test('shapes the job and never leaks internal fields', async () => {
    const result = await toAppJob(baseJob());
    expect(result).toEqual({
      id: 'job-1',
      jobNumber: 'J100',
      status: 'upcoming',
      scheduledDate: new Date('2026-07-12T07:00:00Z'),
      time: '09:00',
      client: 'Tumi Mokoena',
      clientPhone: '+27 82 000 0000',
      address: '12 Acacia Rd, Sandton',
      jobType: 'CCTV install',
      task: '2x IP camera install',
      priority: 'Medium',
      checklist: [{ label: 'Mount cameras', done: false }],
      parts: ['Cat6 cable'],
      photos: [],
      hasSignature: false,
      startedAt: null,
      completedAt: null,
      durationMinutes: null,
    });
    expect(JSON.stringify(result)).not.toContain('should-never-leak');
    expect(result.clientRef).toBeUndefined();
    expect(result.technicianRef).toBeUndefined();
  });

  test('address prefers site over the client billing address', async () => {
    const result = await toAppJob(baseJob({ site: 'Unit 4, Business Park' }));
    expect(result.address).toBe('Unit 4, Business Park');
  });

  test('address falls back to empty string when neither exists', async () => {
    const result = await toAppJob(baseJob({ site: '', clientRef: { name: 'X', billingAddress: '', contactPhone: '' } }));
    expect(result.address).toBe('');
  });

  test('handles an unpopulated clientRef without throwing', async () => {
    const result = await toAppJob(baseJob({ clientRef: 'raw-objectid' }));
    expect(result.client).toBe('');
    expect(result.clientPhone).toBe('');
    expect(result.address).toBe('');
  });

  test('task falls back to jobType when notes are empty', async () => {
    const result = await toAppJob(baseJob({ notes: '' }));
    expect(result.task).toBe('CCTV install');
  });

  test('withUrls: false leaves photo urls null and never calls the storage service', async () => {
    const result = await toAppJob(baseJob({ photos: [{ path: 'uid/jobs/job-1/a.jpg', uploadedAt: new Date() }] }));
    expect(result.photos[0].url).toBeNull();
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  test('withUrls: true attaches signed URLs per photo', async () => {
    createSignedUrls.mockResolvedValue(new Map([['uid/jobs/job-1/a.jpg', 'https://signed/a.jpg']]));
    const result = await toAppJob(
      baseJob({ photos: [{ path: 'uid/jobs/job-1/a.jpg', uploadedAt: new Date() }] }),
      { withUrls: true }
    );
    expect(result.photos[0].url).toBe('https://signed/a.jpg');
  });

  test('a signing miss degrades that photo to url:null, not a throw', async () => {
    createSignedUrls.mockResolvedValue(new Map([['uid/jobs/job-1/a.jpg', null]]));
    const result = await toAppJob(
      baseJob({ photos: [{ path: 'uid/jobs/job-1/a.jpg', uploadedAt: new Date() }] }),
      { withUrls: true }
    );
    expect(result.photos[0].url).toBeNull();
  });

  test('hasSignature is true only for a non-empty signature', async () => {
    expect((await toAppJob(baseJob())).hasSignature).toBe(false);
    expect((await toAppJob(baseJob({ signature: { svgPaths: [] } }))).hasSignature).toBe(false);
    expect((await toAppJob(baseJob({ signature: { svgPaths: ['M0 0L1 1'] } }))).hasSignature).toBe(true);
  });

  test('completed job carries durationMinutes', async () => {
    const result = await toAppJob(baseJob({
      status: 'Completed',
      startedAt: new Date('2026-07-12T08:00:00Z'),
      completedAt: new Date('2026-07-12T09:20:00Z'),
    }));
    expect(result.status).toBe('done');
    expect(result.durationMinutes).toBe(80);
  });
});
