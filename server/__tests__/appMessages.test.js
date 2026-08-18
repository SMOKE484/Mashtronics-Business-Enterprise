'use strict';

// requireClientAuth (imported by routes/appMessages, unused by these handler
// tests directly) pulls in jwks-rsa -> jose, an ESM package Jest can't parse
// without transforming node_modules — mock it out, same as clientAuth.test.js.
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: jest.fn() })));
jest.mock('../models/Message', () => ({ find: jest.fn(), create: jest.fn() }));
jest.mock('../services/realtime', () => ({ publish: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/aiChat', () => ({ getAiReply: jest.fn() }));

const Message = require('../models/Message');
const { publish } = require('../services/realtime');
const { getAiReply } = require('../services/aiChat');
const {
  listHandler, createHandler, escalateHandler, setTopicHandler, triggerAiReply,
} = require('../routes/appMessages');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function findChain(result) {
  return { sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(result) }) };
}

function makeClient(overrides = {}) {
  return {
    _id: 'client-1',
    name: 'Vhulenda Test Residence',
    chatMode: 'ai',
    chatTopic: '',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/app/messages (listHandler)', () => {
  test('returns the message list alongside the client\'s chatMode and chatTopic', async () => {
    const msgs = [{ _id: 'm1', text: 'hi' }];
    Message.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(msgs) });
    const req = { client: makeClient({ chatMode: 'human', chatTopic: 'billing' }) };
    const res = mockRes();

    await listHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ messages: msgs, chatMode: 'human', chatTopic: 'billing' });
  });

  test('returns 500 when the query fails', async () => {
    Message.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('db down')) });
    const req = { client: makeClient() };
    const res = mockRes();

    await listHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('POST /api/app/messages (createHandler)', () => {
  test('rejects an empty message', async () => {
    const req = { client: makeClient(), body: { text: '   ' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Message.create).not.toHaveBeenCalled();
  });

  test('in human mode: saves and publishes the client message, and never calls the AI', async () => {
    const savedMessage = { _id: 'm1', sender: 'client', text: 'help' };
    Message.create.mockResolvedValueOnce(savedMessage);
    const req = { client: makeClient({ chatMode: 'human' }), body: { text: 'help' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(Message.create).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith('client-1', 'chat:message', savedMessage);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(savedMessage);
    expect(getAiReply).not.toHaveBeenCalled();
  });

  test('in ai mode: also triggers an AI reply that gets saved and published', async () => {
    const clientMessage = { _id: 'm1', sender: 'client', text: 'why is my camera offline' };
    const aiMessage = { _id: 'm2', sender: 'ai', text: 'Try checking the power cable.' };
    Message.find.mockReturnValue(findChain([clientMessage]));
    Message.create.mockResolvedValueOnce(clientMessage).mockResolvedValueOnce(aiMessage);
    getAiReply.mockResolvedValue('Try checking the power cable.');
    const req = { client: makeClient({ chatMode: 'ai' }), body: { text: 'why is my camera offline' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(clientMessage);
    expect(Message.create).toHaveBeenCalledTimes(2);
    expect(Message.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ sender: 'ai', text: 'Try checking the power cable.' }));
    expect(publish).toHaveBeenCalledWith('client-1', 'chat:message', aiMessage);
  });

  test('in ai mode: passes the client\'s current chatTopic through to getAiReply, not a hardcoded one', async () => {
    const clientMessage = { _id: 'm1', sender: 'client', text: 'hello' };
    Message.find.mockReturnValue(findChain([clientMessage]));
    Message.create.mockResolvedValueOnce(clientMessage).mockResolvedValueOnce({ _id: 'm2', sender: 'ai', text: 'hi!' });
    getAiReply.mockResolvedValue('hi!');
    const req = { client: makeClient({ chatMode: 'ai', chatTopic: 'billing' }), body: { text: 'hello' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(getAiReply).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'billing');
  });

  test('a save failure returns 400 and never attempts an AI reply', async () => {
    Message.create.mockRejectedValueOnce(new Error('validation failed'));
    const req = { client: makeClient(), body: { text: 'hello' } };
    const res = mockRes();

    await createHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(getAiReply).not.toHaveBeenCalled();
  });
});

describe('triggerAiReply', () => {
  test('saves and publishes the AI reply using recent conversation history', async () => {
    const history = [
      { sender: 'client', text: 'my camera is offline' },
      { sender: 'ai', text: 'is it powered on?' },
      { sender: 'client', text: 'yes' },
    ];
    Message.find.mockReturnValue(findChain(history));
    getAiReply.mockResolvedValue('Try restarting the NVR.');
    const aiMessage = { _id: 'ai-1', sender: 'ai', text: 'Try restarting the NVR.' };
    Message.create.mockResolvedValue(aiMessage);
    const client = makeClient({ chatTopic: 'camera' });

    await triggerAiReply(client);

    expect(getAiReply).toHaveBeenCalledWith(client, [
      { role: 'user', content: 'my camera is offline' },
      { role: 'assistant', content: 'is it powered on?' },
      { role: 'user', content: 'yes' },
    ], 'camera');
    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
      clientRef: 'client-1', sender: 'ai', senderName: 'Mashtronics AI', text: 'Try restarting the NVR.',
    }));
    expect(publish).toHaveBeenCalledWith('client-1', 'chat:message', aiMessage);
  });

  test('degrades to a visible system message when DeepSeek fails — never throws', async () => {
    Message.find.mockReturnValue(findChain([]));
    getAiReply.mockRejectedValue(new Error('DeepSeek request failed (500)'));
    const fallback = { _id: 'sys-1', sender: 'system', text: expect.any(String) };
    Message.create.mockResolvedValue(fallback);

    await expect(triggerAiReply(makeClient())).resolves.toBeUndefined();

    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
      sender: 'system', text: expect.stringMatching(/couldn't process/i),
    }));
    expect(publish).toHaveBeenCalledWith('client-1', 'chat:message', fallback);
  });

  test('shows a distinct message when the per-client cooldown is hit', async () => {
    Message.find.mockReturnValue(findChain([]));
    const cooldownErr = new Error('cooldown');
    cooldownErr.code = 'COOLDOWN';
    getAiReply.mockRejectedValue(cooldownErr);
    Message.create.mockResolvedValue({ _id: 'sys-2', sender: 'system' });

    await triggerAiReply(makeClient());

    expect(Message.create).toHaveBeenCalledWith(expect.objectContaining({
      sender: 'system', text: expect.stringMatching(/hourly limit/i),
    }));
  });
});

describe('POST /api/app/messages/escalate (escalateHandler)', () => {
  test('flips chatMode to human and inserts a system message', async () => {
    const client = makeClient({ chatMode: 'ai' });
    const systemMessage = { _id: 'sys-3', sender: 'system', text: expect.any(String) };
    Message.create.mockResolvedValue(systemMessage);
    const req = { client };
    const res = mockRes();

    await escalateHandler(req, res);

    expect(client.chatMode).toBe('human');
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith('client-1', 'chat:message', systemMessage);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 400 when the save fails', async () => {
    const client = makeClient({ save: jest.fn().mockRejectedValue(new Error('db down')) });
    const req = { client };
    const res = mockRes();

    await escalateHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('PATCH /api/app/messages/topic (setTopicHandler)', () => {
  test.each(['camera', 'billing', 'general', 'other'])('persists a valid topic "%s" and returns it', async (topic) => {
    const client = makeClient({ chatTopic: '' });
    const req = { client, body: { topic } };
    const res = mockRes();

    await setTopicHandler(req, res);

    expect(client.chatTopic).toBe(topic);
    expect(client.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ chatTopic: topic });
  });

  test('an empty string clears the topic (client asked to change topic)', async () => {
    const client = makeClient({ chatTopic: 'billing' });
    const req = { client, body: { topic: '' } };
    const res = mockRes();

    await setTopicHandler(req, res);

    expect(client.chatTopic).toBe('');
    expect(res.json).toHaveBeenCalledWith({ chatTopic: '' });
  });

  test('rejects an unrecognized topic with 400 and does not save', async () => {
    const client = makeClient({ chatTopic: '' });
    const req = { client, body: { topic: 'nonsense' } };
    const res = mockRes();

    await setTopicHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(client.save).not.toHaveBeenCalled();
    expect(client.chatTopic).toBe('');
  });

  test('rejects a missing topic with 400', async () => {
    const client = makeClient();
    const req = { client, body: {} };
    const res = mockRes();

    await setTopicHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(client.save).not.toHaveBeenCalled();
  });

  test('returns 400 when the save fails', async () => {
    const client = makeClient({ save: jest.fn().mockRejectedValue(new Error('db down')) });
    const req = { client, body: { topic: 'general' } };
    const res = mockRes();

    await setTopicHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
