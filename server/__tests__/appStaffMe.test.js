'use strict';
jest.mock('../middleware/staffAuth', () => ({ requireEitherStaffAuth: (req, res, next) => next() }));
const { pushTokenHandler } = require('../routes/appStaffMe');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('PATCH /api/app/staff-me/push-token', () => {
  test('sets the token on the linked staff doc and saves', async () => {
    const staff = { expoPushToken: null, save: jest.fn().mockResolvedValue(undefined) };
    const req = { staff, body: { token: 'ExponentPushToken[abc]' } };
    const res = mockRes();

    await pushTokenHandler(req, res);

    expect(staff.expoPushToken).toBe('ExponentPushToken[abc]');
    expect(staff.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('accepts null to clear the token (e.g. on sign-out)', async () => {
    const staff = { expoPushToken: 'old-token', save: jest.fn().mockResolvedValue(undefined) };
    const req = { staff, body: { token: null } };
    const res = mockRes();

    await pushTokenHandler(req, res);

    expect(staff.expoPushToken).toBeNull();
  });

  test('rejects a non-string, non-null token', async () => {
    const staff = { expoPushToken: null, save: jest.fn() };
    const req = { staff, body: { token: 12345 } };
    const res = mockRes();

    await pushTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(staff.save).not.toHaveBeenCalled();
  });

  test('500s when saving fails', async () => {
    const staff = { expoPushToken: null, save: jest.fn().mockRejectedValue(new Error('db down')) };
    const req = { staff, body: { token: 'tok' } };
    const res = mockRes();

    await pushTokenHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
