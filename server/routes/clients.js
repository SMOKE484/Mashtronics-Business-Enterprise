'use strict';
const express         = require('express');
const Client          = require('../models/Client');
const Invoice         = require('../models/Invoice');
const { requireAuth } = require('../middleware/auth');
const { computeClientRevenue, getClientRevenue } = require('../services/clients');
const { issueInvite } = require('../services/invites');
const { friendlySaveError } = require('../utils/mongoErrors');

const router = express.Router();
router.use(requireAuth);

// GET /api/clients — list, with derived revenue totals per client
router.get('/', async (req, res) => {
  try {
    const [clients, invoices] = await Promise.all([
      Client.find({ archived: false }).sort({ name: 1 }),
      Invoice.find(),
    ]);
    const revenueMap = computeClientRevenue(invoices);
    const out = clients.map(c => ({
      ...c.toObject(),
      ...(revenueMap.get(String(c._id)) || { totalInvoiced: 0, invoiceCount: 0, largestInvoice: 0 }),
    }));
    res.json(out);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/clients/:id — detail, with derived revenue totals
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || client.archived) return res.status(404).json({ error: 'Not found' });
    const invoices = await Invoice.find({ clientRef: client._id });
    const revenue = getClientRevenue(invoices, client._id);
    res.json({ ...client.toObject(), ...revenue });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/clients
async function createHandler(req, res) {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'client') });
  }
}
router.post('/', createHandler);

// PUT /api/clients/:id
async function updateHandler(req, res) {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'client') });
  }
}
router.put('/:id', updateHandler);

// DELETE /api/clients/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/clients/:id/app-invite — generate a SecureWatch app invite code
async function appInviteHandler(req, res) {
  try {
    const client = await Client.findById(req.params.id);
    if (!client || client.archived) return res.status(404).json({ error: 'Not found' });
    const { code, expiresAt } = await issueInvite(client);
    res.json({ inviteCode: code, expiresAt });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

router.post('/:id/app-invite', appInviteHandler);

module.exports = router;
module.exports.appInviteHandler = appInviteHandler;
module.exports.createHandler = createHandler;
module.exports.updateHandler = updateHandler;
