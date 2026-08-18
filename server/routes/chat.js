const express = require('express');
const fetch = require('node-fetch');
const ChatLog = require('../models/ChatLog');
const { requireAuth } = require('../middleware/auth');
const { BASE_SYSTEM_PROMPT } = require('../services/aiChat');

const router = express.Router();

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

router.post('/', async (req, res) => {
  const userMessages = (req.body.messages || [])
    .filter(m => m.role !== 'system')
    .slice(-20);

  const lastUser = [...userMessages].reverse().find(m => m.role === 'user');
  if (lastUser?.content?.trim()) {
    ChatLog.create({ question: lastUser.content.trim() }).catch(() => {});
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...userMessages,
  ];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const dsRes = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        stream: true,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!dsRes.ok) {
      const errText = await dsRes.text();
      res.status(dsRes.status).json({ error: errText });
      return;
    }

    dsRes.body.pipe(res);
  } catch (err) {
    console.error('DeepSeek fetch error:', err);
    res.status(500).json({ error: 'Failed to reach DeepSeek API' });
  }
});

router.get('/questions', requireAuth, async (req, res) => {
  try {
    const [top, totals] = await Promise.all([
      ChatLog.aggregate([
        { $group: { _id: '$question', count: { $sum: 1 }, lastAsked: { $max: '$createdAt' } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
        { $project: { _id: 0, question: '$_id', count: 1, lastAsked: 1 } },
      ]),
      ChatLog.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, unique: { $addToSet: '$question' } } },
        { $project: { total: 1, uniqueCount: { $size: '$unique' } } },
      ]),
    ]);
    res.json({ questions: top, stats: totals[0] ?? { total: 0, uniqueCount: 0 } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load questions' });
  }
});

module.exports = router;
