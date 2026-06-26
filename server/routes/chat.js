const express = require('express');
const fetch = require('node-fetch');
const ChatLog = require('../models/ChatLog');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `You are the friendly virtual assistant for Mashtronics Business Enterprise, a professional security and IT solutions company based in Roodepoort, South Africa, operating since 2015.

SERVICES:
- CCTV Installation (residential & corporate)
- Access Control Systems
- Electric Fencing
- Network Cabling
- Fibre Connectivity
- Fire Detection Systems
- Intrusion Alarm Systems
- Control Rooms
- Intercom Systems

RESIDENTIAL CCTV PACKAGES (fully installed, VAT inclusive):
- 4-camera package: R12,000
- 6-camera package: R14,000
- 8-camera package: R16,000
All packages include NVR, HDD, cameras, cabling, and accessories.

PRICING MODEL:
- Residential (custom): supplier cost + 20% markup + 30% installation fee, minimum install charge R3,000
- Corporate: supplier cost + 35% markup + 30% installation fee, minimum install charge R5,000
- VAT: 15% (VAT number: 4320284435)
- All pricing is an estimate — final quotes are confirmed on-site by a technician.

CONTACT:
- Office: 011 765 4148
- Mobile/WhatsApp: 060 428 4818
- Email: walter@mashtronicsbe.co.za
- Address: Meadgate Unit 18B, Meadgate Centre, Kingfisher Street, Helderkruin, Roodepoort, 1724
- Website: mashtronicsbe.co.za

BEHAVIOUR:
- Be professional, warm, and concise (under 150 words unless detailed explanation is clearly needed)
- Never invent prices outside the packages listed above
- For custom or site-specific quotes, recommend calling 011 765 4148 or emailing walter@mashtronicsbe.co.za
- If asked about something unrelated to Mashtronics services, politely redirect to what you can help with
- Do not discuss competitors`;

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
