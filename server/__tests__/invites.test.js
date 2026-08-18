'use strict';
jest.mock('../services/sms', () => ({ sendInviteSms: jest.fn() }));
const { sendInviteSms } = require('../services/sms');
const { generateInviteCode, issueInvite, deliverInviteSms, INVITE_TTL_MS } = require('../services/invites');

beforeEach(() => jest.clearAllMocks());

describe('generateInviteCode', () => {
  test('returns an 8-character uppercase hex code', () => {
    const { code } = generateInviteCode();
    expect(code).toMatch(/^[0-9A-F]{8}$/);
  });

  test('sets expiresAt 7 days out', () => {
    const before = Date.now();
    const { expiresAt } = generateInviteCode();
    const after = Date.now();
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + INVITE_TTL_MS);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + INVITE_TTL_MS);
  });

  test('generates distinct codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode().code));
    expect(codes.size).toBe(20);
  });
});

describe('issueInvite', () => {
  test('sets appInviteCode/appInviteExpiresAt on the client and saves it', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const client = { appInviteCode: null, appInviteExpiresAt: null, save };

    const result = await issueInvite(client);

    expect(client.appInviteCode).toBe(result.code);
    expect(client.appInviteExpiresAt).toBe(result.expiresAt);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('propagates a save failure', async () => {
    const client = { save: jest.fn().mockRejectedValue(new Error('db down')) };
    await expect(issueInvite(client)).rejects.toThrow('db down');
  });
});

describe('deliverInviteSms', () => {
  test('sends to the normalized number and reports success', async () => {
    sendInviteSms.mockResolvedValue(undefined);

    const result = await deliverInviteSms('082 123 4567', 'ABCD1234');

    expect(sendInviteSms).toHaveBeenCalledWith('+27821234567', 'ABCD1234');
    expect(result).toEqual({ sent: true });
  });

  test('reports a friendly reason when no phone is on file, without calling Twilio', async () => {
    const result = await deliverInviteSms('', 'ABCD1234');

    expect(sendInviteSms).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, reason: 'No phone number on file for this record.' });
  });

  test('reports a friendly reason for a malformed phone number, without calling Twilio', async () => {
    const result = await deliverInviteSms('not-a-phone', 'ABCD1234');

    expect(sendInviteSms).not.toHaveBeenCalled();
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/valid South African phone number/);
  });

  test('degrades gracefully to a friendly reason when the SMS send throws, never leaking the raw error', async () => {
    sendInviteSms.mockRejectedValue(new Error('Twilio trial accounts cannot send to unverified numbers'));

    const result = await deliverInviteSms('082 123 4567', 'ABCD1234');

    expect(result.sent).toBe(false);
    expect(result.reason).not.toMatch(/Twilio/);
    expect(result.reason).toBe("Couldn't send the SMS — share the code manually.");
  });
});
