'use strict';
const express         = require('express');
const Message         = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const { publish }     = require('../services/realtime');

const router = express.Router();
router.use(requireAuth);

// GET /api/messages?clientId=<id>
router.get('/', async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });
  try {
    const messages = await Message.find({ clientRef: clientId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/messages
router.post('/', async (req, res) => {
  const { clientId, text } = req.body;
  if (!clientId || !text || !text.trim()) {
    return res.status(400).json({ error: 'clientId and text are required' });
  }
  try {
    const message = await Message.create({
      clientRef: clientId,
      sender: 'admin',
      senderName: req.user.username,
      text: text.trim(),
    });
    await publish(clientId, 'chat:message', message);
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
