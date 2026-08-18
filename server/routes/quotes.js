'use strict';
const express         = require('express');
const Package         = require('../models/Package');
const Quote           = require('../models/Quote');
const Counter         = require('../models/Counter');
const Client          = require('../models/Client');
const { requireAuth } = require('../middleware/auth');
const {
  calcPackage,
  calcCustomResidential,
  calcCorporate,
  calcTravel,
} = require('../services/pricing');
const {
  calcLine,
  calcSection,
  calcManualQuote,
} = require('../services/quoteCalc');

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
      status:       'sent',
      sentDate:     new Date(),
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
      .populate('packageRef', 'name priceInclVAT')
      .populate('clientRef', 'name');
    res.json(quotes);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/quotes/:id — admin only ─────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('packageRef').populate('clientRef', 'name');
    if (!quote) return res.status(404).json({ error: 'Not found' });
    res.json(quote);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/quotes/:id/status — admin only ─────────────────────────────────
const QUOTE_STATUSES = ['draft', 'sent', 'follow_up_due', 'won', 'lost'];
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status, followUpDate } = req.body;
  if (!QUOTE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const update = { status };
    if (status === 'sent') update.sentDate = new Date();
    if (followUpDate !== undefined) update.followUpDate = followUpDate || null;
    const quote = await Quote.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!quote) return res.status(404).json({ error: 'Not found' });
    res.json(quote);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── admin helpers ────────────────────────────────────────────────────────────

/**
 * Prices an auto-mode (residential/corporate) MBMS quote. Independent from the
 * public POST / handler above by design — that handler must stay untouched so
 * the public lead-capture flow can never regress.
 */
async function priceAutoAdmin({ type, packageId, items, travelData }) {
  const savedItems = [];
  let packageRef, pricing;

  if (type === 'residential') {
    let pkgPricing = null, itemsPricing = null;
    if (packageId) {
      const pkg = await Package.findById(packageId);
      if (!pkg || !pkg.active) return { error: { status: 404, message: 'Package not found' } };
      pkgPricing = calcPackage(pkg.priceInclVAT);
      packageRef = pkg._id;
      savedItems.push({ description: pkg.name, qty: 1, unitPrice: pkg.priceInclVAT, lineTotal: pkg.priceInclVAT });
    }
    const validItems = (items || []).filter(i => i.supplierCost > 0);
    if (validItems.length > 0) {
      const { calculated, agg } = aggregateItems(validItems, calcCustomResidential);
      itemsPricing = agg;
      calculated.forEach(item => savedItems.push({
        description: item.description || 'Item', qty: item.qty || 1, supplierCost: item.supplierCost,
        unitPrice: item.markedUp, lineTotal: item.total,
      }));
    }
    if (!pkgPricing && !itemsPricing) return { error: { status: 400, message: 'Select a package or add at least one item' } };
    const subtotal = r2((pkgPricing ? pkgPricing.exclVAT : 0) + (itemsPricing ? itemsPricing.subtotal : 0) + travelData.travelSubtotal);
    const vatAmount = r2((pkgPricing ? pkgPricing.vatAmount : 0) + (itemsPricing ? itemsPricing.vatAmount : 0) + travelData.travelVAT);
    const total = r2((pkgPricing ? pkgPricing.total : 0) + (itemsPricing ? itemsPricing.total : 0) + travelData.travelTotal);
    const installation = r2(itemsPricing ? itemsPricing.installation : 0);
    pricing = { subtotal, vatAmount, total, installation };
  } else if (type === 'corporate') {
    const validItems = (items || []).filter(i => i.supplierCost > 0);
    if (validItems.length === 0) return { error: { status: 400, message: 'Add at least one item' } };
    const { calculated, agg } = aggregateItems(validItems, calcCorporate);
    calculated.forEach(item => savedItems.push({
      description: item.description || 'Item', qty: item.qty || 1, supplierCost: item.supplierCost,
      unitPrice: item.markedUp, lineTotal: item.total,
    }));
    const subtotal = r2(agg.subtotal + travelData.travelSubtotal);
    const vatAmount = r2(agg.vatAmount + travelData.travelVAT);
    const total = r2(agg.total + travelData.travelTotal);
    pricing = { subtotal, vatAmount, total, installation: agg.installation };
  } else {
    return { error: { status: 400, message: 'type must be residential or corporate for auto mode' } };
  }

  return { packageRef, savedItems, pricing };
}

function priceManual(sections) {
  const computedSections = (sections || []).map(sec => {
    const computedItems = (sec.items || []).map(item => ({ ...item, lineTotal: calcLine(item).lineTotal }));
    return { title: sec.title || 'Section', items: computedItems, subtotal: calcSection(computedItems).subtotal };
  });
  const { subtotal, vatAmount, total } = calcManualQuote(computedSections);
  return { computedSections, subtotal, vatAmount, total };
}

async function resolveCustomer({ clientRef, customerName, customerPhone, customerEmail }) {
  let client = null;
  if (clientRef) {
    client = await Client.findById(clientRef);
    if (!client) return { error: { status: 404, message: 'Client not found' } };
  }
  const finalName  = customerName  || (client && client.name) || '';
  const finalPhone = customerPhone || (client && client.contactPhone) || '';
  if (!finalName) return { error: { status: 400, message: 'clientRef or customerName required' } };
  return {
    customerName: finalName,
    customerPhone: finalPhone,
    customerEmail: customerEmail || (client && client.contactEmail) || undefined,
  };
}

// ── POST /api/quotes/admin — admin only, both auto and manual mode ───────────
router.post('/admin', requireAuth, async (req, res) => {
  const {
    mode, clientRef, customerName, customerPhone, customerEmail,
    site, scopeOfWork, quoteDate, validUntil, preparedBy, status, followUpDate,
    type, packageId, items, travel, sections,
  } = req.body;

  try {
    const customer = await resolveCustomer({ clientRef, customerName, customerPhone, customerEmail });
    if (customer.error) return res.status(customer.error.status).json({ error: customer.error.message });

    const counter = await Counter.findOneAndUpdate(
      { name: 'quoteNumber' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    const quoteNumber = `Q${counter.seq}`;

    const baseFields = {
      quoteNumber,
      clientRef: clientRef || undefined,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      customerEmail: customer.customerEmail,
      site: site || '', scopeOfWork: scopeOfWork || '',
      quoteDate: quoteDate || new Date(), validUntil: validUntil || undefined, preparedBy: preparedBy || '',
      status: status === 'sent' ? 'sent' : 'draft',
      sentDate: status === 'sent' ? new Date() : undefined,
      followUpDate: followUpDate || undefined,
    };

    if (mode === 'manual') {
      if (!Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ error: 'At least one section is required' });
      }
      const { computedSections, subtotal, vatAmount, total } = priceManual(sections);
      const quote = await Quote.create({
        ...baseFields, mode: 'manual', sections: computedSections,
        subtotal, vatAmount, total, installation: 0,
      });
      return res.status(201).json(quote);
    }

    // ── auto mode ────────────────────────────────────────────────────────────
    let travelData = { travelKm: undefined, travelRatePerKm: undefined, travelSubtotal: 0, travelVAT: 0, travelTotal: 0 };
    if (travel && travel.km > 0 && travel.ratePerKm > 0) {
      const tb = calcTravel(Number(travel.km), Number(travel.ratePerKm));
      travelData = { travelKm: tb.km, travelRatePerKm: tb.ratePerKm, travelSubtotal: tb.travelExcl, travelVAT: tb.travelVAT, travelTotal: tb.travelTotal };
    }
    const result = await priceAutoAdmin({ type, packageId, items, travelData });
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });

    const quote = await Quote.create({
      ...baseFields, mode: 'auto', type, packageRef: result.packageRef, items: result.savedItems,
      subtotal: result.pricing.subtotal, installation: result.pricing.installation,
      vatAmount: result.pricing.vatAmount, total: result.pricing.total,
      ...travelData,
    });
    res.status(201).json(quote);
  } catch (err) {
    console.error('Admin save quote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/quotes/admin/:id — admin only, edit/reopen a draft ──────────────
router.put('/admin/:id', requireAuth, async (req, res) => {
  const {
    clientRef, customerName, customerPhone, customerEmail,
    site, scopeOfWork, quoteDate, validUntil, preparedBy, followUpDate,
    mode, type, packageId, items, travel, sections,
  } = req.body;

  try {
    const existing = await Quote.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const customer = await resolveCustomer({ clientRef, customerName, customerPhone, customerEmail });
    if (customer.error) return res.status(customer.error.status).json({ error: customer.error.message });

    const baseFields = {
      clientRef: clientRef || undefined,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      customerEmail: customer.customerEmail,
      site: site || '', scopeOfWork: scopeOfWork || '',
      quoteDate: quoteDate || existing.quoteDate, validUntil: validUntil || undefined, preparedBy: preparedBy || '',
      followUpDate: followUpDate || undefined,
    };

    const effectiveMode = mode || existing.mode;

    if (effectiveMode === 'manual') {
      if (!Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({ error: 'At least one section is required' });
      }
      const { computedSections, subtotal, vatAmount, total } = priceManual(sections);
      const quote = await Quote.findByIdAndUpdate(req.params.id, {
        ...baseFields, mode: 'manual', sections: computedSections,
        subtotal, vatAmount, total, installation: 0,
      }, { new: true, runValidators: true });
      return res.json(quote);
    }

    let travelData = { travelKm: undefined, travelRatePerKm: undefined, travelSubtotal: 0, travelVAT: 0, travelTotal: 0 };
    if (travel && travel.km > 0 && travel.ratePerKm > 0) {
      const tb = calcTravel(Number(travel.km), Number(travel.ratePerKm));
      travelData = { travelKm: tb.km, travelRatePerKm: tb.ratePerKm, travelSubtotal: tb.travelExcl, travelVAT: tb.travelVAT, travelTotal: tb.travelTotal };
    }
    const result = await priceAutoAdmin({ type, packageId, items, travelData });
    if (result.error) return res.status(result.error.status).json({ error: result.error.message });

    const quote = await Quote.findByIdAndUpdate(req.params.id, {
      ...baseFields, mode: 'auto', type, packageRef: result.packageRef, items: result.savedItems,
      subtotal: result.pricing.subtotal, installation: result.pricing.installation,
      vatAmount: result.pricing.vatAmount, total: result.pricing.total,
      ...travelData,
    }, { new: true, runValidators: true });
    res.json(quote);
  } catch (err) {
    console.error('Admin update quote error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/quotes/:id — admin only ──────────────────────────────────────
async function deleteHandler(req, res) {
  try {
    const quote = await Quote.findByIdAndDelete(req.params.id);
    if (!quote) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id', requireAuth, deleteHandler);

module.exports = router;
module.exports.deleteHandler = deleteHandler;
