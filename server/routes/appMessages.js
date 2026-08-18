'use strict';
const express               = require('express');
const Message               = require('../models/Message');
const { requireClientAuth } = require('../middleware/clientAuth');
const { publish }           = require('../services/realtime');
const { getAiReply }        = require('../services/aiChat');

const router = express.Router();
router.use(requireClientAuth);

const AI_FALLBACK_TEXT = "Sorry, I couldn't process that right now — tap \"Talk to a real person\" below and a Mashtronics representative will help.";
const AI_COOLDOWN_TEXT = "You've reached the AI assistant's hourly limit — tap \"Talk to a real person\" below and a Mashtronics representative will help.";
const AI_HISTORY_LIMIT = 20;
const VALID_TOPICS = ['', 'camera', 'billing', 'general', 'other'];

// Called after a client message is saved when the conversation is in 'ai'
// mode. Never throws — a DeepSeek failure or cooldown degrades to a visible
// system message instead of leaving the client staring at nothing.
async function triggerAiReply(client) {
  try {
    const history = await Message.find({ clientRef: client._id, sender: { $in: ['client', 'admin', 'ai'] } })
      .sort({ createdAt: 1 })
      .limit(AI_HISTORY_LIMIT * 2);
    const conversation = history.slice(-AI_HISTORY_LIMIT).map(m => ({
      role: m.sender === 'client' ? 'user' : 'assistant',
      content: m.text,
    }));

    const reply = await getAiReply(client, conversation, client.chatTopic);
    const aiMessage = await Message.create({
      clientRef: client._id,
      sender: 'ai',
      senderName: 'Mashtronics AI',
      text: reply,
    });
    await publish(String(client._id), 'chat:message', aiMessage);
  } catch (err) {
    const fallback = await Message.create({
      clientRef: client._id,
      sender: 'system',
      text: err.code === 'COOLDOWN' ? AI_COOLDOWN_TEXT : AI_FALLBACK_TEXT,
    });
    await publish(String(client._id), 'chat:message', fallback);
  }
}

// GET /api/app/messages
async function listHandler(req, res) {
  try {
    const messages = await Message.find({ clientRef: req.client._id }).sort({ createdAt: 1 });
    res.json({ messages, chatMode: req.client.chatMode, chatTopic: req.client.chatTopic });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

// POST /api/app/messages
async function createHandler(req, res) {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  let message;
  try {
    message = await Message.create({
      clientRef: req.client._id,
      sender: 'client',
      senderName: req.client.name,
      text: text.trim(),
    });
    await publish(String(req.client._id), 'chat:message', message);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  res.status(201).json(message);

  if (req.client.chatMode === 'ai') {
    await triggerAiReply(req.client);
  }
}

// PATCH /api/app/messages/topic — client picks (or clears, via '') what this
// conversation is about. Gates whether the AI gets camera-diagnostic
// behaviour: see buildAppSystemPrompt in services/aiChat.js.
async function setTopicHandler(req, res) {
  const { topic } = req.body;
  if (!VALID_TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid topic' });
  }
  try {
    req.client.chatTopic = topic;
    await req.client.save();
    res.json({ chatTopic: req.client.chatTopic });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// POST /api/app/messages/escalate — client asked to talk to a real person.
async function escalateHandler(req, res) {
  try {
    req.client.chatMode = 'human';
    await req.client.save();
    const message = await Message.create({
      clientRef: req.client._id,
      sender: 'system',
      text: "You're now connected with a Mashtronics representative.",
    });
    await publish(String(req.client._id), 'chat:message', message);
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

router.get('/', listHandler);
router.post('/', createHandler);
router.post('/escalate', escalateHandler);
router.patch('/topic', setTopicHandler);

module.exports = router;
module.exports.listHandler = listHandler;
module.exports.createHandler = createHandler;
module.exports.escalateHandler = escalateHandler;
module.exports.setTopicHandler = setTopicHandler;
module.exports.triggerAiReply = triggerAiReply;
