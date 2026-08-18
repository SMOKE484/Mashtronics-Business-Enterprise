'use strict';
const express         = require('express');
const Message         = require('../models/Message');
const Client          = require('../models/Client');
const { requireAuth } = require('../middleware/auth');
const { publish }     = require('../services/realtime');

const router = express.Router();
router.use(requireAuth);

// GET /api/messages/threads — one row per client with a conversation, for
// the admin inbox. Threads needing a human (chatMode 'human') sort first,
// then by most recent activity.
async function listHandler(req, res) {
  try {
    const rows = await Message.aggregate([
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$clientRef',
          lastText: { $last: '$text' },
          lastSender: { $last: '$sender' },
          lastAt: { $last: '$createdAt' },
          unreadCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$sender', 'client'] }, { $eq: ['$readByAdmin', false] }] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: '$client' },
      { $match: { 'client.archived': false } },
      {
        $project: {
          _id: 0,
          clientId: '$_id',
          clientName: '$client.name',
          chatMode: '$client.chatMode',
          lastText: 1, lastSender: 1, lastAt: 1, unreadCount: 1,
        },
      },
      { $sort: { chatMode: -1, lastAt: -1 } },
    ]);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /api/messages/threads/:clientId/read — mark this client's messages seen.
async function markReadHandler(req, res) {
  try {
    await Message.updateMany(
      { clientRef: req.params.clientId, sender: 'client', readByAdmin: false },
      { $set: { readByAdmin: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PATCH /api/messages/threads/:clientId/resolve — hand the conversation back to AI.
async function resolveHandler(req, res) {
  try {
    const client = await Client.findOne({ _id: req.params.clientId, archived: false });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    client.chatMode = 'ai';
    await client.save();
    const message = await Message.create({
      clientRef: client._id,
      sender: 'system',
      text: 'This conversation has been handed back to the Mashtronics AI assistant.',
    });
    await publish(String(client._id), 'chat:message', message);
    res.json({ ok: true, message });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

router.get('/', listHandler);
router.patch('/:clientId/read', markReadHandler);
router.patch('/:clientId/resolve', resolveHandler);

module.exports = router;
module.exports.listHandler = listHandler;
module.exports.markReadHandler = markReadHandler;
module.exports.resolveHandler = resolveHandler;
