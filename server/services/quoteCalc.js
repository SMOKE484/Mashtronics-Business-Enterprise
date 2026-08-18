'use strict';

const VAT_RATE = 0.15;

function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Manual-mode line item. No markup formula — unitPrice is entered directly by the admin.
 */
function calcLine({ qty = 1, unitPrice = 0, discountPct = 0 }) {
  const lineTotal = r2(qty * unitPrice * (1 - discountPct / 100));
  return { lineTotal };
}

/**
 * Section = sum of its lines' totals.
 */
function calcSection(items = []) {
  const subtotal = r2(items.reduce((sum, item) => sum + calcLine(item).lineTotal, 0));
  return { subtotal };
}

/**
 * Whole manual quote = sum of section subtotals, VAT 15% on the total.
 */
function calcManualQuote(sections = []) {
  const subtotal  = r2(sections.reduce((sum, sec) => sum + calcSection(sec.items).subtotal, 0));
  const vatAmount = r2(subtotal * VAT_RATE);
  const total     = r2(subtotal + vatAmount);
  return { subtotal, vatAmount, total };
}

module.exports = { calcLine, calcSection, calcManualQuote };
