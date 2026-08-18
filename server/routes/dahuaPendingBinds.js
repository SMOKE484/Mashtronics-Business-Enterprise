'use strict';
const express              = require('express');
const DahuaPendingBind     = require('../models/DahuaPendingBind');
const Camera               = require('../models/Camera');
const Client                = require('../models/Client');
const dahua                 = require('../services/dahua');
const { requireAuth }       = require('../middleware/auth');
const { friendlySaveError } = require('../utils/mongoErrors');

const router = express.Router();
router.use(requireAuth);

// GET /api/dahua-pending-binds?status=pending
async function listHandler(req, res) {
  try {
    const status = ['pending', 'resolved', 'ignored'].includes(req.query.status) ? req.query.status : 'pending';
    const binds = await DahuaPendingBind.find({ status })
      .sort({ receivedAt: -1 })
      .populate('suggestedClientRef', 'name')
      .populate('resolvedClientRef', 'name');
    res.json(binds);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/', listHandler);

// POST /api/dahua-pending-binds/:id/resolve — { clientRef, name, location }
async function resolveHandler(req, res) {
  try {
    const pending = await DahuaPendingBind.findById(req.params.id);
    if (!pending || pending.status !== 'pending') return res.status(404).json({ error: 'Not found' });

    const { clientRef, name, location } = req.body || {};
    if (!clientRef) return res.status(400).json({ error: 'Choose a client to assign this device to.' });
    const client = await Client.findOne({ _id: clientRef, archived: false });
    if (!client) return res.status(400).json({ error: 'That client could not be found.' });

    // Activate before creating the Camera record — an activation failure
    // should never leave an orphaned, permanently-broken Camera behind
    // (every Dahua device API 400s with BIZ084 "Device not activated" until
    // this succeeds, per the 2026-08-01 session).
    try {
      await dahua.setActivationStatus([pending.deviceSerial], 1);
    } catch (err) {
      console.error('[dahuaPendingBinds] setActivationStatus failed:', err.message);
      return res.status(502).json({ error: 'Dahua rejected the device activation — the device was not assigned. Try again shortly.' });
    }

    const camera = await Camera.create({
      clientRef: client._id,
      name: name || `Device ${pending.deviceSerial}`,
      location: location || '',
      deviceSerial: pending.deviceSerial,
      streamProvider: 'dahua',
    });

    pending.status = 'resolved';
    pending.resolvedClientRef = client._id;
    pending.resolvedCameraRef = camera._id;
    pending.resolvedAt = new Date();
    await pending.save();

    res.json({ ok: true, cameraId: String(camera._id) });
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'camera') });
  }
}
router.post('/:id/resolve', resolveHandler);

// POST /api/dahua-pending-binds/:id/ignore
async function ignoreHandler(req, res) {
  try {
    const pending = await DahuaPendingBind.findById(req.params.id);
    if (!pending || pending.status !== 'pending') return res.status(404).json({ error: 'Not found' });
    pending.status = 'ignored';
    pending.resolvedAt = new Date();
    await pending.save();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.post('/:id/ignore', ignoreHandler);

module.exports = router;
module.exports.listHandler = listHandler;
module.exports.resolveHandler = resolveHandler;
module.exports.ignoreHandler = ignoreHandler;
