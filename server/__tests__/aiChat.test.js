'use strict';

const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);
jest.mock('../models/Camera', () => ({ find: jest.fn() }));

const Camera = require('../models/Camera');
const { getAiReply, buildAppSystemPrompt, BASE_SYSTEM_PROMPT } = require('../services/aiChat');

function mockSort(result) {
  return { sort: jest.fn().mockResolvedValue(result) };
}

function fakeDeepSeekResponse(content) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
  };
}

const client = { _id: 'client-1', name: 'Vhulenda Test Residence' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BASE_SYSTEM_PROMPT', () => {
  test('names Dahua as the residential camera brand', () => {
    expect(BASE_SYSTEM_PROMPT).toMatch(/Dahua/);
  });
});

describe('buildAppSystemPrompt', () => {
  test('topic "camera": includes each camera\'s name, status and signal, plus diagnostic instructions', () => {
    const cameras = [
      { name: 'Front Gate', location: 'Driveway', status: 'online', signal: 'Strong', model: 'Dahua IPC' },
      { name: 'Back Yard', location: 'Pool area', status: 'offline', signal: 'Weak', model: 'Dahua IPC' },
    ];
    const prompt = buildAppSystemPrompt(client, cameras, 'camera');
    expect(prompt).toMatch(/Front Gate/);
    expect(prompt).toMatch(/online/);
    expect(prompt).toMatch(/Back Yard/);
    expect(prompt).toMatch(/offline/);
    expect(prompt).toMatch(/Weak/);
    expect(prompt).toMatch(/numbered self-fix steps/);
  });

  test('topic "camera": says so plainly when the client has no cameras yet', () => {
    const prompt = buildAppSystemPrompt(client, [], 'camera');
    expect(prompt).toMatch(/no cameras registered yet/);
  });

  test.each(['billing', 'general', 'other', ''])('topic "%s": omits camera summary and diagnostic instructions', (topic) => {
    const cameras = [
      { name: 'Front Gate', location: 'Driveway', status: 'online', signal: 'Strong' },
    ];
    const prompt = buildAppSystemPrompt(client, cameras, topic);
    expect(prompt).not.toMatch(/Front Gate/);
    expect(prompt).not.toMatch(/numbered self-fix steps/);
    expect(prompt).not.toMatch(/CLIENT'S CAMERAS/);
    expect(prompt).toMatch(/Change topic/);
  });
});

describe('getAiReply', () => {
  test('resolves with the DeepSeek reply text', async () => {
    Camera.find.mockReturnValue(mockSort([]));
    mockFetch.mockResolvedValue(fakeDeepSeekResponse('Try restarting the NVR.'));

    const reply = await getAiReply(client, [{ role: 'user', content: 'My camera is offline' }], 'camera');

    expect(reply).toBe('Try restarting the NVR.');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('topic "camera": queries Camera.find', async () => {
    Camera.find.mockReturnValue(mockSort([]));
    mockFetch.mockResolvedValue(fakeDeepSeekResponse('ok'));

    await getAiReply(client, [], 'camera');

    expect(Camera.find).toHaveBeenCalledWith({ clientRef: client._id, archived: false });
  });

  test.each(['billing', 'general', 'other', ''])('topic "%s": never queries Camera.find', async (topic) => {
    mockFetch.mockResolvedValue(fakeDeepSeekResponse('ok'));

    await getAiReply(client, [], topic);

    expect(Camera.find).not.toHaveBeenCalled();
  });

  test('throws when DeepSeek returns a non-OK response', async () => {
    Camera.find.mockReturnValue(mockSort([]));
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: jest.fn().mockResolvedValue('server error') });

    await expect(getAiReply(client, [], 'camera')).rejects.toThrow(/DeepSeek request failed/);
  });

  test('throws when DeepSeek returns an empty reply', async () => {
    Camera.find.mockReturnValue(mockSort([]));
    mockFetch.mockResolvedValue(fakeDeepSeekResponse('   '));

    await expect(getAiReply(client, [], 'camera')).rejects.toThrow(/empty reply/);
  });

  test('rejects with a COOLDOWN error once the per-client hourly limit is hit, without calling DeepSeek again', async () => {
    Camera.find.mockReturnValue(mockSort([]));
    mockFetch.mockResolvedValue(fakeDeepSeekResponse('ok'));
    const busyClient = { _id: 'client-cooldown', name: 'Busy Client' };

    for (let i = 0; i < 20; i++) {
      await getAiReply(busyClient, [], 'general');
    }
    mockFetch.mockClear();

    await expect(getAiReply(busyClient, [], 'general')).rejects.toMatchObject({ code: 'COOLDOWN' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
