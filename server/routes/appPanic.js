'use strict';
const express               = require('express');
const PanicAlert            = require('../models/PanicAlert');
const { requireClientAuth } = require('../middleware/clientAuth');
const { publish }           = require('../services/realtime');

const router = express.Router();
router.use(requireClientAuth);

// GET /api/app/panic/active — the client's current active alert, if any
router.get('/active', async (req, res) => {
  try {
    const alert = await PanicAlert.findOne({ clientRef: req.client._id, status: 'active' }).sort({ createdAt: -1 });
    res.json(alert || null);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/app/panic — client confirms the panic alert (after local arming countdown)
router.post('/', async (req, res) => {
  try {
    const alert = await PanicAlert.create({
      clientRef: req.client._id,
      status: 'active',
      stages: [{ label: 'Alert dispatched', detail: 'Response control room received' }],
    });
    await publish(String(req.client._id), 'panic:new', alert);
    res.status(201).json(alert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/app/panic/:id/stand-down — client marks themselves safe
router.patch('/:id/stand-down', async (req, res) => {
  try {
    const alert = await PanicAlert.findOne({ _id: req.params.id, clientRef: req.client._id });
    if (!alert) return res.status(404).json({ error: 'Not found' });
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.stages.push({ label: "I'm safe — stand down", detail: 'Confirmed by client' });
    await alert.save();
    await publish(String(req.client._id), 'panic:update', alert);
    res.json(alert);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
