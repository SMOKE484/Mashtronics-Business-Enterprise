'use strict';
const express         = require('express');
const Invoice         = require('../models/Invoice');
const Counter         = require('../models/Counter');
const { requireAuth } = require('../middleware/auth');
const { friendlySaveError } = require('../utils/mongoErrors');

const router = express.Router();
router.use(requireAuth);

function r2(n) { return Math.round(n * 100) / 100; }

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ issuedDate: -1 }).populate('clientRef', 'name');
    res.json(invoices);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('clientRef', 'name');
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/invoices — amount is always server-computed from subtotal + vatAmount
async function createHandler(req, res) {
  try {
    const { clientRef, quoteRef, jobRef, subtotal, vatAmount, issuedDate, dueDate } = req.body;
    const counter = await Counter.findOneAndUpdate(
      { name: 'invoiceNumber' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    const invoiceNumber = `INV-${new Date(issuedDate || Date.now()).getFullYear()}-${String(counter.seq).padStart(3, '0')}`;
    const invoice = await Invoice.create({
      invoiceNumber, clientRef, quoteRef, jobRef,
      subtotal: r2(subtotal), vatAmount: r2(vatAmount), amount: r2(subtotal + vatAmount),
      issuedDate, dueDate,
    });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'invoice') });
  }
}
router.post('/', createHandler);

// PUT /api/invoices/:id
async function updateHandler(req, res) {
  try {
    const { invoiceNumber, amount, subtotal, vatAmount, ...rest } = req.body;
    const updates = { ...rest };
    if (subtotal !== undefined && vatAmount !== undefined) {
      updates.subtotal = r2(subtotal);
      updates.vatAmount = r2(vatAmount);
      updates.amount = r2(subtotal + vatAmount);
    }
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'invoice') });
  }
}
router.put('/:id', updateHandler);

// DELETE /api/invoices/:id
async function deleteHandler(req, res) {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id', deleteHandler);

// PATCH /api/invoices/:id/status — mark paid/sent
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['sent', 'paid'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const updates = { status };
    if (status === 'paid') updates.paidDate = new Date();
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    res.json(invoice);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.createHandler = createHandler;
module.exports.updateHandler = updateHandler;
module.exports.deleteHandler = deleteHandler;
