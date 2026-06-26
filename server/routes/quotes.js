'use strict';
const express         = require('express');
const Package         = require('../models/Package');
const Quote           = require('../models/Quote');
const Counter         = require('../models/Counter');
const { requireAuth } = require('../middleware/auth');
const {
  calcPackage,
  calcCustomResidential,
  calcCorporate,
  calcTravel,
} = require('../services/pricing');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function r2(n) { return Math.round(n * 100) / 100; }

/**
 * Aggregate per-item results into a single breakdown object.
 * Minimum install applies per item individually (already handled in calcFn).
 */
function aggregateItems(items, calcFn) {
  const calculated = items.map(item =>
    ({ ...item, ...calcFn({ supplierCost: item.supplierCost, qty: item.qty || 1 }) })
  );
  const agg = calculated.reduce((acc, item) => ({
    markedUp:     (acc.markedUp     || 0) + item.markedUp,
    installation: (acc.installation || 0) + item.installation,
    subtotal:     (acc.subtotal     || 0) + item.subtotal,
    vatAmount:    (acc.vatAmount    || 0) + item.vatAmount,
    total:        (acc.total        || 0) + item.total,
  }), {});
  return { calculated, agg };
}

// ── POST /api/quotes/calculate ────────────────────────────────────────────────
// Public endpoint — returns breakdown without saving.
// Supports legacy types (package, custom_residential) and new residential type.
router.post('/calculate', async (req, res) => {
  const { type, packageId, items, travel } = req.body;

  try {
    // ── New unified residential type ─────────────────────────────────────────
    if (type === 'residential') {
      let packageBreakdown = null;
      let itemsBreakdown   = null;
      let travelBreakdown  = null;

      if (packageId) {
        const pkg = await Package.findById(packageId);
        if (!pkg || !pkg.active) return res.status(404).json({ error: 'Package not found' });
        packageBreakdown = { ...calcPackage(pkg.priceInclVAT), name: pkg.name };
      }

      const validItems = (items || []).filter(i => i.supplierCost > 0);
      if (validItems.length > 0) {
        const { agg } = aggregateItems(validItems, calcCustomResidential);
        itemsBreakdown = agg;
      }

      if (travel && travel.km > 0 && travel.ratePerKm > 0) {
        travelBreakdown = calcTravel(Number(travel.km), Number(travel.ratePerKm));
      }

      if (!packageBreakdown && !itemsBreakdown) {
        return res.status(400).json({ error: 'Select a package or add at least one item' });
      }

      const grandSubtotal = r2(
        (packageBreakdown ? packageBreakdown.exclVAT   : 0) +
        (itemsBreakdown   ? itemsBreakdown.subtotal    : 0) +
        (travelBreakdown  ? travelBreakdown.travelExcl : 0)
      );
      const grandVAT = r2(
        (packageBreakdown ? packageBreakdown.vatAmount   : 0) +
        (itemsBreakdown   ? itemsBreakdown.vatAmount     : 0) +
        (travelBreakdown  ? travelBreakdown.travelVAT    : 0)
      );
      const grandTotal = r2(
        (packageBreakdown ? packageBreakdown.total        : 0) +
        (itemsBreakdown   ? itemsBreakdown.total          : 0) +
        (travelBreakdown  ? travelBreakdown.travelTotal   : 0)
      );

      return res.json({
        type,
        packageBreakdown,
        itemsBreakdown,
        travelBreakdown,
        grand: { subtotal: grandSubtotal, vatAmount: grandVAT, total: grandTotal },
      });
    }

    // ── Corporate ────────────────────────────────────────────────────────────
    if (type === 'corporate') {
      const validItems = (items || []).filter(i => i.supplierCost > 0);
      if (validItems.length === 0) {
        return res.status(400).json({ error: 'Add at least one item' });
      }

      const { agg: itemsBreakdown } = aggregateItems(validItems, calcCorporate);

      let travelBreakdown = null;
      if (travel && travel.km > 0 && travel.ratePerKm > 0) {
        travelBreakdown = calcTravel(Number(travel.km), Number(travel.ratePerKm));
      }

      const grandSubtotal = r2(itemsBreakdown.subtotal + (travelBreakdown ? travelBreakdown.travelExcl : 0));
      const grandVAT      = r2(itemsBreakdown.vatAmount + (travelBreakdown ? travelBreakdown.travelVAT  : 0));
      const grandTotal    = r2(itemsBreakdown.total     + (travelBreakdown ? travelBreakdown.travelTotal : 0));

      return res.json({
        type,
        packageBreakdown: null,
        itemsBreakdown,
        travelBreakdown,
        grand: { subtotal: grandSubtotal, vatAmount: grandVAT, total: grandTotal },
      });
    }

    // ── Legacy: package ───────────────────────────────────────────────────────
    if (type === 'package') {
      if (!packageId) return res.status(400).json({ error: 'packageId required' });
      const pkg = await Package.findById(packageId);
      if (!pkg || !pkg.active) return res.status(404).json({ error: 'Package not found' });
      const breakdown = calcPackage(pkg.priceInclVAT);
      return res.json({ type, package: { name: pkg.name, priceInclVAT: pkg.priceInclVAT }, breakdown });
    }

    // ── Legacy: custom_residential ───────────────────────────────────────────
    if (type === 'custom_residential') {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items array required' });
      }
      const { calculated, agg } = aggregateItems(items, calcCustomResidential);
      return res.json({ type, items: calculated, breakdown: agg });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error('Calculate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/quotes ──────────────────────────────────────────────────────────
// Public endpoint — saves quote lead to DB.
router.post('/', async (req, res) => {
  const { type, packageId, items, travel, customerName, customerPhone, customerEmail } = req.body;

  if (!customerName || !customerPhone) {
    return res.status(400).json({ error: 'customerName and customerPhone required' });
  }

  try {
    const counter = await Counter.findOneAndUpdate(
      { name: 'quoteNumber' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    const quoteNumber = `Q${counter.seq}`;

    let pricing, packageRef, savedItems = [];
    let travelData = { travelKm: undefined, travelRatePerKm: undefined, travelSubtotal: 0, travelVAT: 0, travelTotal: 0 };

    // ── travel helper ────────────────────────────────────────────────────────
    if (travel && travel.km > 0 && travel.ratePerKm > 0) {
      const tb = calcTravel(Number(travel.km), Number(travel.ratePerKm));
      travelData = { travelKm: tb.km, travelRatePerKm: tb.ratePerKm, travelSubtotal: tb.travelExcl, travelVAT: tb.travelVAT, travelTotal: tb.travelTotal };
    }

    // ── residential (new unified type) ───────────────────────────────────────
    if (type === 'residential') {
      let pkgPricing = null;
      let itemsPricing = null;

      if (packageId) {
        const pkg = await Package.findById(packageId);
        if (!pkg || !pkg.active) return res.status(404).json({ error: 'Package not found' });
        pkgPricing = calcPackage(pkg.priceInclVAT);
        packageRef = pkg._id;
        savedItems.push({ description: pkg.name, qty: 1, unitPrice: pkg.priceInclVAT, lineTotal: pkg.priceInclVAT });
      }

      const validItems = (items || []).filter(i => i.supplierCost > 0);
      if (validItems.length > 0) {
        const { calculated, agg } = aggregateItems(validItems, calcCustomResidential);
        itemsPricing = agg;
        calculated.forEach(item => savedItems.push({
          description:  item.description || 'Item',
          qty:          item.qty || 1,
          supplierCost: item.supplierCost,
          unitPrice:    item.markedUp,
          lineTotal:    item.total,
        }));
      }

      if (!pkgPricing && !itemsPricing) {
        return res.status(400).json({ error: 'Select a package or add at least one item' });
      }

      const subtotal     = r2((pkgPricing ? pkgPricing.exclVAT    : 0) + (itemsPricing ? itemsPricing.subtotal  : 0) + travelData.travelSubtotal);
      const vatAmount    = r2((pkgPricing ? pkgPricing.vatAmount   : 0) + (itemsPricing ? itemsPricing.vatAmount : 0) + travelData.travelVAT);
      const total        = r2((pkgPricing ? pkgPricing.total       : 0) + (itemsPricing ? itemsPricing.total     : 0) + travelData.travelTotal);
      const installation = r2(itemsPricing ? itemsPricing.installation : 0);

      pricing = { subtotal, vatAmount, total, installation };
    }

    // ── corporate ────────────────────────────────────────────────────────────
    else if (type === 'corporate') {
      const validItems = (items || []).filter(i => i.supplierCost > 0);
      if (validItems.length === 0) return res.status(400).json({ error: 'items required' });
      const { calculated, agg } = aggregateItems(validItems, calcCorporate);
      calculated.forEach(item => savedItems.push({
        description:  item.description || 'Item',
        qty:          item.qty || 1,
        supplierCost: item.supplierCost,
        unitPrice:    item.markedUp,
        lineTotal:    item.total,
      }));
      const subtotal  = r2(agg.subtotal  + travelData.travelSubtotal);
      const vatAmount = r2(agg.vatAmount + travelData.travelVAT);
      const total     = r2(agg.total     + travelData.travelTotal);
      pricing = { subtotal, vatAmount, total, installation: agg.installation };
    }

    // ── legacy: package ───────────────────────────────────────────────────────
    else if (type === 'package') {
      const pkg = await Package.findById(packageId);
      if (!pkg || !pkg.active) return res.status(404).json({ error: 'Package not found' });
      const p = calcPackage(pkg.priceInclVAT);
      packageRef = pkg._id;
      savedItems = [{ description: pkg.name, qty: 1, unitPrice: pkg.priceInclVAT, lineTotal: pkg.priceInclVAT }];
      pricing = { subtotal: p.exclVAT, installation: 0, vatAmount: p.vatAmount, total: p.total };
    }

    // ── legacy: custom_residential ───────────────────────────────────────────
    else if (type === 'custom_residential') {
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items required' });
      const { calculated, agg } = aggregateItems(items, calcCustomResidential);
      savedItems = calculated.map(item => ({
        description: item.description || 'Item', qty: item.qty || 1,
        supplierCost: item.supplierCost, unitPrice: item.markedUp, lineTotal: item.total,
      }));
      pricing = { subtotal: agg.subtotal, installation: agg.installation, vatAmount: agg.vatAmount, total: agg.total };
    }

    else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const quote = await Quote.create({
      quoteNumber, type, packageRef,
      customerName, customerPhone, customerEmail,
      items:        savedItems,
      subtotal:     pricing.subtotal,
      installation: pricing.installation,
      vatAmount:    pricing.vatAmount,
      total:        pricing.total,
      ...travelData,
    });

    res.status(201).json({ quoteNumber, total: pricing.total, _id: quote._id });
  } catch (err) {
    console.error('Save quote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/quotes — admin only ──────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const quotes = await Quote.find()
      .sort({ createdAt: -1 })
      .populate('packageRef', 'name priceInclVAT');
    res.json(quotes);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/quotes/:id — admin only ─────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('packageRef');
    if (!quote) return res.status(404).json({ error: 'Not found' });
    res.json(quote);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/quotes/:id/status — admin only ─────────────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { leadStatus } = req.body;
  if (!['new', 'contacted', 'converted'].includes(leadStatus)) {
    return res.status(400).json({ error: 'Invalid leadStatus' });
  }
  try {
    const quote = await Quote.findByIdAndUpdate(req.params.id, { leadStatus }, { new: true });
    if (!quote) return res.status(404).json({ error: 'Not found' });
    res.json(quote);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
