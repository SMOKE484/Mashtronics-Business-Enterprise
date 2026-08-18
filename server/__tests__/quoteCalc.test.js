'use strict';
const { calcLine, calcSection, calcManualQuote } = require('../services/quoteCalc');

describe('calcLine', () => {
  test('standard case: qty 3 at R100, no discount', () => {
    const r = calcLine({ qty: 3, unitPrice: 100, discountPct: 0 });
    expect(r.lineTotal).toBe(300);
  });

  test('discount is applied to the line total', () => {
    // 3 * 100 = 300, 10% off = 270
    const r = calcLine({ qty: 3, unitPrice: 100, discountPct: 10 });
    expect(r.lineTotal).toBe(270);
  });

  test('defaults qty to 1 and unitPrice/discount to 0', () => {
    const r = calcLine({});
    expect(r.lineTotal).toBe(0);
  });

  test('rounds to 2dp', () => {
    const r = calcLine({ qty: 3, unitPrice: 38.333, discountPct: 0 });
    expect(r.lineTotal).toBe(parseFloat(r.lineTotal.toFixed(2)));
  });
});

describe('calcSection', () => {
  test('sums line totals across items', () => {
    const r = calcSection([
      { qty: 20, unitPrice: 3450, discountPct: 0 },   // 69000
      { qty: 1, unitPrice: 48500, discountPct: 0 },   // 48500
    ]);
    expect(r.subtotal).toBe(117500);
  });

  test('empty items array produces zero subtotal', () => {
    const r = calcSection([]);
    expect(r.subtotal).toBe(0);
  });
});

describe('calcManualQuote', () => {
  test('sums sections, applies 15% VAT on the grand subtotal', () => {
    // section 1: 20 * 3450 = 69000
    // section 2: 500 * 38 = 19000
    // subtotal = 88000, vat = 13200, total = 101200
    const r = calcManualQuote([
      { items: [{ qty: 20, unitPrice: 3450, discountPct: 0 }] },
      { items: [{ qty: 500, unitPrice: 38, discountPct: 0 }] },
    ]);
    expect(r.subtotal).toBe(88000);
    expect(r.vatAmount).toBe(13200);
    expect(r.total).toBe(101200);
  });

  test('no sections produces all zeros', () => {
    const r = calcManualQuote([]);
    expect(r.subtotal).toBe(0);
    expect(r.vatAmount).toBe(0);
    expect(r.total).toBe(0);
  });

  test('all amounts are rounded to 2dp', () => {
    const r = calcManualQuote([
      { items: [{ qty: 3, unitPrice: 38.333, discountPct: 12.5 }] },
    ]);
    Object.values(r).forEach(v => {
      expect(v).toBe(parseFloat(v.toFixed(2)));
    });
  });
});
