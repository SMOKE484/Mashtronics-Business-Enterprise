'use strict';
jest.mock('../models/ResponseOfficer', () => ({ findById: jest.fn() }));
jest.mock('../services/sms', () => ({ sendInviteSms: jest.fn() }));
const ResponseOfficer = require('../models/ResponseOfficer');
const { sendInviteSms } = require('../services/sms');
const { appInviteHandler } = require('../routes/responseOfficers');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => jest.clearAllMocks());

describe('POST /api/response-officers/:id/app-invite', () => {
  test('404s when the officer does not exist', async () => {
    ResponseOfficer.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('404s for an inactive officer', async () => {
    ResponseOfficer.findById.mockResolvedValue({ active: false, save: jest.fn() });
    const req = { params: { id: 'officer-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('rejects re-inviting an officer who has already linked their account', async () => {
    const save = jest.fn();
    const officer = { active: true, name: 'Thabo', supabaseUserId: 'user-1', save };
    ResponseOfficer.findById.mockResolvedValue(officer);
    const req = { params: { id: 'officer-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Thabo has already linked their account — they don't need a new invite code." });
    expect(save).not.toHaveBeenCalled();
    expect(sendInviteSms).not.toHaveBeenCalled();
  });

  test('issues a code and sends it by SMS when the officer has a phone on file', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const officer = { active: true, phone: '082 123 4567', appInviteCode: null, appInviteExpiresAt: null, save };
    ResponseOfficer.findById.mockResolvedValue(officer);
    sendInviteSms.mockResolvedValue(undefined);
    const req = { params: { id: 'officer-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(save).toHaveBeenCalledTimes(1);
    expect(sendInviteSms).toHaveBeenCalledWith('+27821234567', officer.appInviteCode);
    expect(res.json).toHaveBeenCalledWith({
      inviteCode: officer.appInviteCode,
      expiresAt: officer.appInviteExpiresAt,
      smsSent: true,
      smsError: undefined,
    });
    expect(officer.appInviteCode).toMatch(/^[0-9A-F]{8}$/);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('still issues a valid code when there is no phone on file, and reports why SMS was not sent', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const officer = { active: true, phone: '', appInviteCode: null, appInviteExpiresAt: null, save };
    ResponseOfficer.findById.mockResolvedValue(officer);
    const req = { params: { id: 'officer-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(sendInviteSms).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      inviteCode: officer.appInviteCode,
      expiresAt: officer.appInviteExpiresAt,
      smsSent: false,
      smsError: 'No phone number on file for this record.',
    });
  });

  test('still issues a valid code when the SMS send fails, and reports a friendly reason', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const officer = { active: true, phone: '082 123 4567', appInviteCode: null, appInviteExpiresAt: null, save };
    ResponseOfficer.findById.mockResolvedValue(officer);
    sendInviteSms.mockRejectedValue(new Error('Twilio trial accounts cannot send to unverified numbers'));
    const req = { params: { id: 'officer-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      inviteCode: officer.appInviteCode,
      expiresAt: officer.appInviteExpiresAt,
      smsSent: false,
      smsError: "Couldn't send the SMS — share the code manually.",
    });
  });

  test('returns 500 when the lookup throws', async () => {
    ResponseOfficer.findById.mockRejectedValue(new Error('db down'));
    const req = { params: { id: 'officer-1' } };
    const res = mockRes();

    await appInviteHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
