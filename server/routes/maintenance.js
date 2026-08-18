'use strict';
const express             = require('express');
const MaintenanceContract = require('../models/MaintenanceContract');
const { requireAuth }     = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/maintenance
router.get('/', async (req, res) => {
  try {
    const contracts = await MaintenanceContract.find().sort({ nextVisit: 1 }).populate('clientRef', 'name');
    res.json(contracts);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/maintenance
router.post('/', async (req, res) => {
  try {
    const contract = await MaintenanceContract.create(req.body);
    res.status(201).json(contract);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/maintenance/:id
router.put('/:id', async (req, res) => {
  try {
    const contract = await MaintenanceContract.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!contract) return res.status(404).json({ error: 'Not found' });
    res.json(contract);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/maintenance/:id — soft delete (contract ended)
router.delete('/:id', async (req, res) => {
  try {
    const contract = await MaintenanceContract.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!contract) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
