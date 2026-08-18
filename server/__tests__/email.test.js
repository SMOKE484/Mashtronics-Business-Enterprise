'use strict';
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const { sendInviteEmail } = require('../services/email');

beforeEach(() => jest.clearAllMocks());

describe('sendInviteEmail', () => {
  test('sends via SMTP with the invite code in the body', async () => {
    await sendInviteEmail('client@example.com', 'ABC12345');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const [args] = mockSendMail.mock.calls[0];
    expect(args.to).toBe('client@example.com');
    expect(args.text).toContain('ABC12345');
    expect(args.html).toContain('ABC12345');
  });

  test('propagates an SMTP send failure', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP: auth failed'));
    await expect(sendInviteEmail('client@example.com', 'ABC12345')).rejects.toThrow('SMTP: auth failed');
  });
});
