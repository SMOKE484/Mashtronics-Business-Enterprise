'use strict';

jest.mock('../models/Message', () => ({ aggregate: jest.fn(), updateMany: jest.fn(), create: jest.fn() }));
jest.mock('../models/Client', () => ({ findOne: jest.fn() }));
jest.mock('../services/realtime', () => ({ publish: jest.fn().mockResolvedValue(undefined) }));

const Message = require('../models/Message');
const Client = require('../models/Client');
const { publish } = require('../services/realtime');
const { listHandler, markReadHandler, resolveHandler } = require('../routes/messageThreads');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/messages/threads (listHandler)', () => {
  test('returns the aggregated thread rows as-is', async () => {
    const rows = [
      { clientId: 'c1', clientName: 'Vhulenda Test Residence', chatMode: 'human', lastText: 'help', lastAt: new Date(), unreadCount: 2 },
    ];
    Message.aggregate.mockResolvedValue(rows);
    const req = {};
    const res = mockRes();

    await listHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(rows);
  });

  test('returns 500 when the aggregation fails', async () => {
    Message.aggregate.mockRejectedValue(new Error('db down'));
    const req = {};
    const res = mockRes();

    await listHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('PATCH /api/messages/threads/:clientId/read (markReadHandler)', () => {
  test('marks only that client\'s unread client-sent messages as read', async () => {
    Message.updateMany.mockResolvedValue({ modifiedCount: 3 });
    const req = { params: { clientId: 'c1' } };
    const res = mockRes();

    await markReadHandler(req, res);

    expect(Message.updateMany).toHaveBeenCalledWith(
      { clientRef: 'c1', sender: 'client', readByAdmin: false },
      { $set: { readByAdmin: true } }
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

describe('PATCH /api/messages/threads/:clientId/resolve (resolveHandler)', () => {
  test('flips chatMode back to ai and inserts a handback system message', async () => {
    const client = { _id: 'c1', archived: false, chatMode: 'human', save: jest.fn().mockResolvedValue(undefined) };
    Client.findOne.mockResolvedValue(client);
    const systemMessage = { _id: 'sys-1', sender: 'system' };
    Message.create.mockResolvedValue(systemMessage);
    const req = { params: { clientId: 'c1' } };
    const res = mockRes();

    await resolveHandler(req, res);

    expect(client.chatMode).toBe('ai');
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith('c1', 'chat:message', systemMessage);
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: systemMessage });
  });

  test('returns 404 when the client does not exist or is archived', async () => {
    Client.findOne.mockResolvedValue(null);
    const req = { params: { clientId: 'missing' } };
    const res = mockRes();

    await resolveHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(Message.create).not.toHaveBeenCalled();
  });
});
