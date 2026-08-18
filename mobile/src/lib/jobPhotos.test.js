jest.mock('./supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, storage: { from: jest.fn() } } }));
import { supabase } from './supabase';
import { jobPhotoPath, uploadJobPhoto, BUCKET } from './jobPhotos';

describe('jobPhotoPath', () => {
  test('matches the server-required prefix and filename charset', () => {
    const path = jobPhotoPath('uid-123', 'job-456', 1700000000000, 'abc123');
    expect(path).toBe('uid-123/jobs/job-456/1700000000000-abc123.jpg');
    const fileName = path.split('/')[3];
    expect(fileName).toMatch(/^[\w.-]+$/);
  });

  test('generates defaults that still satisfy the filename charset', () => {
    const fileName = jobPhotoPath('uid', 'job').split('/')[3];
    expect(fileName).toMatch(/^[\w.-]+$/);
  });
});

describe('uploadJobPhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  test('uploads under the signed-in uid and returns the path', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    const upload = jest.fn().mockResolvedValue({ error: null });
    supabase.storage.from.mockReturnValue({ upload });

    const path = await uploadJobPhoto({ jobId: 'job-1', base64: 'aGVsbG8=' });

    expect(supabase.storage.from).toHaveBeenCalledWith(BUCKET);
    expect(path).toMatch(/^uid-1\/jobs\/job-1\/[\w.-]+\.jpg$/);
    expect(upload.mock.calls[0][0]).toBe(path);
    expect(upload.mock.calls[0][2]).toEqual({ contentType: 'image/jpeg' });
  });

  test('throws a readable error without a base64 payload', async () => {
    await expect(uploadJobPhoto({ jobId: 'j', base64: '' })).rejects.toThrow(/read the photo/i);
  });

  test('throws a readable error when the session is gone', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(uploadJobPhoto({ jobId: 'j', base64: 'aGVsbG8=' })).rejects.toThrow(/session expired/i);
  });

  test('throws a readable error when the upload fails (raw Supabase error never surfaces)', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
    supabase.storage.from.mockReturnValue({ upload: jest.fn().mockResolvedValue({ error: { message: 'row-level security violation' } }) });

    await expect(uploadJobPhoto({ jobId: 'j', base64: 'aGVsbG8=' })).rejects.toThrow(/couldn't upload/i);
    await expect(uploadJobPhoto({ jobId: 'j', base64: 'aGVsbG8=' })).rejects.not.toThrow(/row-level/i);
  });
});
