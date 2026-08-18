'use strict';
jest.mock('../middleware/staffAuth', () => ({ requireTechnicianAuth: (req, res, next) => next() }));
jest.mock('../models/Job', () => ({ find: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../services/storage', () => ({
  createSignedUrls: jest.fn().mockResolvedValue(new Map()),
  objectExists: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(true),
}));

const Job = require('../models/Job');
const { createSignedUrls, objectExists, deleteObject } = require('../services/storage');
const {
  listHandler, historyHandler, statsHandler, detailHandler,
  startHandler, checklistHandler, addPhotoHandler, removePhotoHandler, completeHandler,
  SIGNATURE_MAX_CHARS, MAX_PHOTOS,
} = require('../routes/appJobs');

const TECH_ID = '507f1f77bcf86cd799439011';
const JOB_ID = '507f1f77bcf86cd799439022';
const UID = 'a3f1c9d2-1111-2222-3333-444455556666';

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function baseReq(overrides = {}) {
  return { technician: { _id: TECH_ID }, supabaseUserId: UID, params: {}, body: {}, query: {}, ...overrides };
}

function jobDoc(overrides = {}) {
  return {
    _id: JOB_ID,
    jobNumber: 'J100',
    status: 'In Progress',
    scheduledDate: new Date('2026-07-12T07:00:00Z'),
    scheduledTime: '09:00',
    clientRef: { name: 'Tumi', billingAddress: '12 Acacia Rd', contactPhone: '+27820000000' },
    site: '',
    jobType: 'CCTV install',
    priority: 'Medium',
    notes: '',
    checklist: [{ label: 'a', done: true }, { label: 'b', done: true }],
    parts: [],
    photos: [{ path: `${UID}/jobs/${JOB_ID}/1.jpg`, uploadedAt: new Date() }],
    signature: null,
    startedAt: new Date('2026-07-12T08:00:00Z'),
    completedAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockFindOne(doc) {
  Job.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(doc) });
}

function mockFindChain(docs) {
  const chain = {
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    populate: jest.fn().mockResolvedValue(docs),
  };
  Job.find.mockReturnValue(chain);
  return chain;
}

const VALID_SIGNATURE = { svgPaths: ['M10 20L30 40'], viewWidth: 300, viewHeight: 150 };

beforeEach(() => {
  jest.clearAllMocks();
  createSignedUrls.mockResolvedValue(new Map());
  deleteObject.mockResolvedValue(true);
});

describe('GET /api/app/jobs (listHandler)', () => {
  test('scopes to the technician, shows only active statuses, sorted earliest-first', async () => {
    const chain = mockFindChain([jobDoc()]);
    const res = mockRes();

    await listHandler(baseReq(), res);

    const filter = Job.find.mock.calls[0][0];
    expect(filter.technicianRef).toBe(TECH_ID);
    expect(filter.status).toEqual({ $in: ['Scheduled', 'In Progress'] });
    expect(filter.scheduledDate).toBeUndefined();
    expect(chain.sort).toHaveBeenCalledWith({ scheduledDate: 1, scheduledTime: 1 });
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ id: JOB_ID, status: 'in-progress' })]);
  });

  test('500s when the query throws', async () => {
    Job.find.mockImplementation(() => { throw new Error('db down'); });
    const res = mockRes();

    await listHandler(baseReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('GET /api/app/jobs/history (historyHandler)', () => {
  test('returns completed jobs sorted by completedAt desc with a limit', async () => {
    const chain = mockFindChain([]);
    const res = mockRes();

    await historyHandler(baseReq(), res);

    expect(Job.find).toHaveBeenCalledWith({ technicianRef: TECH_ID, status: 'Completed' });
    expect(chain.sort).toHaveBeenCalledWith({ completedAt: -1 });
    expect(chain.limit).toHaveBeenCalledWith(50);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('caps a huge limit param at 200', async () => {
    const chain = mockFindChain([]);
    await historyHandler(baseReq({ query: { limit: '99999' } }), mockRes());
    expect(chain.limit).toHaveBeenCalledWith(200);
  });
});

describe('GET /api/app/jobs/stats (statsHandler)', () => {
  test('returns week and total completed counts scoped to the technician', async () => {
    Job.countDocuments.mockResolvedValueOnce(3).mockResolvedValueOnce(27);
    const res = mockRes();

    await statsHandler(baseReq(), res);

    expect(Job.countDocuments.mock.calls[0][0]).toMatchObject({ technicianRef: TECH_ID, status: 'Completed' });
    expect(res.json).toHaveBeenCalledWith({ completedThisWeek: 3, completedTotal: 27 });
  });
});

describe('GET /api/app/jobs/:id (detailHandler)', () => {
  test('404s on an invalid ObjectId without querying', async () => {
    const res = mockRes();
    await detailHandler(baseReq({ params: { id: 'not-an-id' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(Job.findOne).not.toHaveBeenCalled();
  });

  test("404s when the job belongs to another technician (scoped query, doesn't leak)", async () => {
    mockFindOne(null);
    const res = mockRes();

    await detailHandler(baseReq({ params: { id: JOB_ID } }), res);

    expect(Job.findOne).toHaveBeenCalledWith({ _id: JOB_ID, technicianRef: TECH_ID });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns the job with signed photo URLs', async () => {
    createSignedUrls.mockResolvedValue(new Map([[`${UID}/jobs/${JOB_ID}/1.jpg`, 'https://signed/1.jpg']]));
    mockFindOne(jobDoc());
    const res = mockRes();

    await detailHandler(baseReq({ params: { id: JOB_ID } }), res);

    const body = res.json.mock.calls[0][0];
    expect(body.photos[0].url).toBe('https://signed/1.jpg');
  });
});

describe('PATCH /api/app/jobs/:id/start (startHandler)', () => {
  test('starts a Scheduled job and stamps startedAt', async () => {
    const job = jobDoc({ status: 'Scheduled', startedAt: null });
    mockFindOne(job);
    const res = mockRes();

    await startHandler(baseReq({ params: { id: JOB_ID } }), res);

    expect(job.status).toBe('In Progress');
    expect(job.startedAt).toBeInstanceOf(Date);
    expect(job.save).toHaveBeenCalled();
  });

  test('is idempotent when already In Progress (200, no save)', async () => {
    const job = jobDoc();
    mockFindOne(job);
    const res = mockRes();

    await startHandler(baseReq({ params: { id: JOB_ID } }), res);

    expect(job.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test('409s on a Completed job', async () => {
    mockFindOne(jobDoc({ status: 'Completed' }));
    const res = mockRes();
    await startHandler(baseReq({ params: { id: JOB_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'This job is already completed' });
  });

  test('409s on a Cancelled job', async () => {
    mockFindOne(jobDoc({ status: 'Cancelled' }));
    const res = mockRes();
    await startHandler(baseReq({ params: { id: JOB_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'This job was cancelled' });
  });
});

describe('PATCH /api/app/jobs/:id/checklist/:index (checklistHandler)', () => {
  test('sets an item done and saves', async () => {
    const job = jobDoc({ checklist: [{ label: 'a', done: false }] });
    mockFindOne(job);
    const res = mockRes();

    await checklistHandler(baseReq({ params: { id: JOB_ID, index: '0' }, body: { done: true } }), res);

    expect(job.checklist[0].done).toBe(true);
    expect(job.save).toHaveBeenCalled();
  });

  test('explicit set is retry-safe (setting done=true twice stays true)', async () => {
    const job = jobDoc({ checklist: [{ label: 'a', done: true }] });
    mockFindOne(job);

    await checklistHandler(baseReq({ params: { id: JOB_ID, index: '0' }, body: { done: true } }), mockRes());

    expect(job.checklist[0].done).toBe(true);
  });

  test('400s on out-of-bounds and non-integer indices', async () => {
    for (const index of ['5', '-1', '0.5', 'abc']) {
      mockFindOne(jobDoc({ checklist: [{ label: 'a', done: false }] }));
      const res = mockRes();
      await checklistHandler(baseReq({ params: { id: JOB_ID, index }, body: { done: true } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  test('400s when done is not a boolean', async () => {
    mockFindOne(jobDoc({ checklist: [{ label: 'a', done: false }] }));
    const res = mockRes();
    await checklistHandler(baseReq({ params: { id: JOB_ID, index: '0' }, body: { done: 'yes' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('409s when the job has not been started', async () => {
    mockFindOne(jobDoc({ status: 'Scheduled' }));
    const res = mockRes();
    await checklistHandler(baseReq({ params: { id: JOB_ID, index: '0' }, body: { done: true } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Start the job first' });
  });

  test('409s when the job is already completed', async () => {
    mockFindOne(jobDoc({ status: 'Completed' }));
    const res = mockRes();
    await checklistHandler(baseReq({ params: { id: JOB_ID, index: '0' }, body: { done: true } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('POST /api/app/jobs/:id/photos (addPhotoHandler)', () => {
  const goodPath = `${UID}/jobs/${JOB_ID}/1699999999-abc.jpg`;

  test('records a valid, existing upload', async () => {
    objectExists.mockResolvedValue(true);
    const job = jobDoc({ photos: [] });
    mockFindOne(job);
    const res = mockRes();

    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: goodPath } }), res);

    expect(job.photos).toEqual([{ path: goodPath }]);
    expect(job.save).toHaveBeenCalled();
  });

  test("400s on a path under someone else's uid", async () => {
    const job = jobDoc({ photos: [] });
    mockFindOne(job);
    const res = mockRes();

    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: `other-uid/jobs/${JOB_ID}/1.jpg` } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid photo path' });
    expect(objectExists).not.toHaveBeenCalled();
  });

  test('400s on a path under a different job id', async () => {
    mockFindOne(jobDoc({ photos: [] }));
    const res = mockRes();
    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: `${UID}/jobs/507f1f77bcf86cd799439033/1.jpg` } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s on an unsafe filename (path traversal)', async () => {
    mockFindOne(jobDoc({ photos: [] }));
    const res = mockRes();
    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: `${UID}/jobs/${JOB_ID}/../../evil.jpg` } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s on a missing/non-string path', async () => {
    for (const body of [{}, { path: 42 }]) {
      mockFindOne(jobDoc({ photos: [] }));
      const res = mockRes();
      await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  test('400s when the object was never actually uploaded (phantom path)', async () => {
    objectExists.mockResolvedValue(false);
    const job = jobDoc({ photos: [] });
    mockFindOne(job);
    const res = mockRes();

    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: goodPath } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "That photo didn't finish uploading — try again" });
    expect(job.save).not.toHaveBeenCalled();
  });

  test('400s on a duplicate path', async () => {
    objectExists.mockResolvedValue(true);
    mockFindOne(jobDoc({ photos: [{ path: goodPath, uploadedAt: new Date() }] }));
    const res = mockRes();
    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: goodPath } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('400s at the photo cap', async () => {
    const photos = Array.from({ length: MAX_PHOTOS }, (_, i) => ({ path: `${UID}/jobs/${JOB_ID}/${i}.jpg` }));
    mockFindOne(jobDoc({ photos }));
    const res = mockRes();
    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: goodPath } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('409s when the job is not in progress', async () => {
    mockFindOne(jobDoc({ status: 'Scheduled', photos: [] }));
    const res = mockRes();
    await addPhotoHandler(baseReq({ params: { id: JOB_ID }, body: { path: goodPath } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('DELETE /api/app/jobs/:id/photos/:index (removePhotoHandler)', () => {
  test('removes the photo and best-effort deletes the object', async () => {
    const path = `${UID}/jobs/${JOB_ID}/1.jpg`;
    const job = jobDoc({ photos: [{ path, uploadedAt: new Date() }] });
    mockFindOne(job);
    const res = mockRes();

    await removePhotoHandler(baseReq({ params: { id: JOB_ID, index: '0' } }), res);

    expect(job.photos).toEqual([]);
    expect(job.save).toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith(path);
  });

  test('400s on a bad index', async () => {
    mockFindOne(jobDoc());
    const res = mockRes();
    await removePhotoHandler(baseReq({ params: { id: JOB_ID, index: '9' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('409s when the job is completed', async () => {
    mockFindOne(jobDoc({ status: 'Completed' }));
    const res = mockRes();
    await removePhotoHandler(baseReq({ params: { id: JOB_ID, index: '0' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('POST /api/app/jobs/:id/complete (completeHandler)', () => {
  test('completes when every gate passes', async () => {
    const job = jobDoc();
    mockFindOne(job);
    const res = mockRes();

    await completeHandler(baseReq({ params: { id: JOB_ID }, body: { signature: VALID_SIGNATURE } }), res);

    expect(job.status).toBe('Completed');
    expect(job.completedAt).toBeInstanceOf(Date);
    expect(job.signature.svgPaths).toEqual(VALID_SIGNATURE.svgPaths);
    expect(job.signature.capturedAt).toBeInstanceOf(Date);
    expect(job.save).toHaveBeenCalled();
  });

  test('409s with a progress message when the checklist is not done', async () => {
    mockFindOne(jobDoc({ checklist: [{ label: 'a', done: true }, { label: 'b', done: false }] }));
    const res = mockRes();

    await completeHandler(baseReq({ params: { id: JOB_ID }, body: { signature: VALID_SIGNATURE } }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Only 1/2 tasks are complete — finish the checklist first' });
  });

  test('409s with zero photos', async () => {
    mockFindOne(jobDoc({ photos: [] }));
    const res = mockRes();
    await completeHandler(baseReq({ params: { id: JOB_ID }, body: { signature: VALID_SIGNATURE } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Add at least one proof-of-work photo before completing' });
  });

  test('400s on a missing, empty, malformed or oversized signature', async () => {
    const bad = [
      undefined,
      { svgPaths: [] },
      { svgPaths: ['M0 0<script>'] },
      { svgPaths: [''] },
      { svgPaths: ['M0 0L1 1'.repeat(Math.ceil(SIGNATURE_MAX_CHARS / 8) + 10)] },
    ];
    for (const signature of bad) {
      mockFindOne(jobDoc());
      const res = mockRes();
      await completeHandler(baseReq({ params: { id: JOB_ID }, body: { signature } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  test('409s on double-complete', async () => {
    mockFindOne(jobDoc({ status: 'Completed' }));
    const res = mockRes();
    await completeHandler(baseReq({ params: { id: JOB_ID }, body: { signature: VALID_SIGNATURE } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'This job is already completed' });
  });

  test('409s when the job was never started', async () => {
    mockFindOne(jobDoc({ status: 'Scheduled' }));
    const res = mockRes();
    await completeHandler(baseReq({ params: { id: JOB_ID }, body: { signature: VALID_SIGNATURE } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Start the job first' });
  });
});
