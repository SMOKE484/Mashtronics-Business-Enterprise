'use strict';
const mockCreate = jest.fn().mockResolvedValue({ sid: 'SM123' });
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const { sendInviteSms } = require('../services/sms');

beforeEach(() => jest.clearAllMocks());

describe('sendInviteSms', () => {
  test('sends via Twilio with the invite code in the message body', async () => {
    await sendInviteSms('+27821234567', 'ABC12345');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [args] = mockCreate.mock.calls[0];
    expect(args.to).toBe('+27821234567');
    expect(args.body).toContain('ABC12345');
  });

  test('propagates a Twilio send failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Twilio: invalid number'));
    await expect(sendInviteSms('+27821234567', 'ABC12345')).rejects.toThrow('Twilio: invalid number');
  });
});
