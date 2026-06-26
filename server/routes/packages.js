'use strict';
const express         = require('express');
const Package         = require('../models/Package');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/packages — public
router.get('/', async (req, res) => {
  try {
    const pkgs = await Package.find({ active: true }).sort({ priceInclVAT: 1 });
    res.json(pkgs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/packages/:id — public
router.get('/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg || !pkg.active) return res.status(404).json({ error: 'Not found' });
    res.json(pkg);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/packages — admin only
router.post('/', requireAuth, async (req, res) => {
  try {
    const pkg = await Package.create(req.body);
    res.status(201).json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/packages/:id — admin only
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!pkg) return res.status(404).json({ error: 'Not found' });
    res.json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/packages/:id — admin only (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!pkg) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
