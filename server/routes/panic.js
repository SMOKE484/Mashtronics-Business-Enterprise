'use strict';
const express         = require('express');
const PanicAlert      = require('../models/PanicAlert');
const { requireAuth } = require('../middleware/auth');
const { publish }     = require('../services/realtime');

const router = express.Router();
router.use(requireAuth);

// GET /api/panic?status=active
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const alerts = await PanicAlert.find(filter)
      .sort({ triggeredAt: -1 })
      .populate('clientRef', 'name contactPhone');
    res.json(alerts);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/panic/:id/stage — dispatcher appends a status update
router.patch('/:id/stage', async (req, res) => {
  const { label, detail, technicianRef } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  try {
    const alert = await PanicAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    alert.stages.push({ label, detail, technicianRef });
    await alert.save();
    await publish(String(alert.clientRef), 'panic:update', alert);
    res.json(alert);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/panic/:id/resolve
router.patch('/:id/resolve', async (req, res) => {
  try {
    const alert = await PanicAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    alert.status = req.body.status === 'cancelled' ? 'cancelled' : 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();
    await publish(String(alert.clientRef), 'panic:update', alert);
    res.json(alert);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
