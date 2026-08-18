'use strict';
const express         = require('express');
const ComplianceDoc   = require('../models/ComplianceDoc');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/compliance
router.get('/', async (req, res) => {
  try {
    const docs = await ComplianceDoc.find({ active: true }).sort({ expiryDate: 1 });
    res.json(docs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/compliance
router.post('/', async (req, res) => {
  try {
    const doc = await ComplianceDoc.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/compliance/:id
router.put('/:id', async (req, res) => {
  try {
    const doc = await ComplianceDoc.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/compliance/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const doc = await ComplianceDoc.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
