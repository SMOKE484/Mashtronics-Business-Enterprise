'use strict';
const { calcPackage, calcCustomResidential, calcCorporate, calcTravel } = require('../services/pricing');

describe('calcPackage', () => {
  test('R12,000 package decomposes correctly', () => {
    const r = calcPackage(12000);
    expect(r.total).toBe(12000);
    expect(r.exclVAT).toBe(10434.78);
    expect(r.vatAmount).toBe(1565.22);
  });

  test('R14,000 package decomposes correctly', () => {
    const r = calcPackage(14000);
    expect(r.total).toBe(14000);
    expect(r.exclVAT).toBe(12173.91);
    expect(r.vatAmount).toBe(1826.09);
  });

  test('R16,000 package decomposes correctly', () => {
    const r = calcPackage(16000);
    expect(r.total).toBe(16000);
    expect(r.exclVAT).toBe(13913.04);
    expect(r.vatAmount).toBe(2086.96);
  });

  test('all returned amounts are rounded to 2dp', () => {
    const r = calcPackage(12000);
    [r.exclVAT, r.vatAmount, r.total].forEach(v => {
      expect(v).toBe(parseFloat(v.toFixed(2)));
    });
  });
});

describe('calcCustomResidential', () => {
  test('standard case: supplierCost R10,000', () => {
    // markedUp = 10000 * 1.20 = 12000
    // install  = max(12000 * 0.30, 3000) = max(3600, 3000) = 3600
    // subtotal = 12000 + 3600 = 15600
    // vat      = 15600 * 0.15 = 2340
    // total    = 15600 + 2340 = 17940
    const r = calcCustomResidential({ supplierCost: 10000 });
    expect(r.markedUp).toBe(12000);
    expect(r.installation).toBe(3600);
    expect(r.subtotal).toBe(15600);
    expect(r.vatAmount).toBe(2340);
    expect(r.total).toBe(17940);
  });

  test('minimum install R3,000 kicks in when 30% of markedUp < 3000', () => {
    // supplierCost = 5000 → markedUp = 6000 → 30% = 1800 < 3000 → install = 3000
    const r = calcCustomResidential({ supplierCost: 5000 });
    expect(r.markedUp).toBe(6000);
    expect(r.installation).toBe(3000);
    expect(r.subtotal).toBe(9000);
    expect(r.vatAmount).toBe(1350);
    expect(r.total).toBe(10350);
  });

  test('qty multiplier is applied before markup', () => {
    const single = calcCustomResidential({ supplierCost: 10000, qty: 1 });
    const double = calcCustomResidential({ supplierCost: 10000, qty: 2 });
    expect(double.markedUp).toBe(single.markedUp * 2);
    expect(double.markedUp).toBe(24000);
  });

  test('all amounts are rounded to 2dp', () => {
    const r = calcCustomResidential({ supplierCost: 7777 });
    Object.values(r).forEach(v => {
      expect(v).toBe(parseFloat(v.toFixed(2)));
    });
  });
});

describe('calcCorporate', () => {
  test('standard case: supplierCost R20,000', () => {
    // markedUp = 20000 * 1.35 = 27000
    // install  = max(27000 * 0.30, 5000) = max(8100, 5000) = 8100
    // subtotal = 27000 + 8100 = 35100
    // vat      = 35100 * 0.15 = 5265
    // total    = 35100 + 5265 = 40365
    const r = calcCorporate({ supplierCost: 20000 });
    expect(r.markedUp).toBe(27000);
    expect(r.installation).toBe(8100);
    expect(r.subtotal).toBe(35100);
    expect(r.vatAmount).toBe(5265);
    expect(r.total).toBe(40365);
  });

  test('minimum install R5,000 kicks in when 30% of markedUp < 5000', () => {
    // supplierCost = 5000 → markedUp = 6750 → 30% = 2025 < 5000 → install = 5000
    const r = calcCorporate({ supplierCost: 5000 });
    expect(r.markedUp).toBe(6750);
    expect(r.installation).toBe(5000);
    expect(r.subtotal).toBe(11750);
    expect(r.vatAmount).toBe(1762.50);
    expect(r.total).toBe(13512.50);
  });

  test('corporate uses 35% markup, not 20%', () => {
    const res = calcCustomResidential({ supplierCost: 10000 });
    const corp = calcCorporate({ supplierCost: 10000 });
    expect(corp.markedUp).toBeGreaterThan(res.markedUp);
    expect(corp.markedUp).toBe(13500);
  });

  test('all amounts are rounded to 2dp', () => {
    const r = calcCorporate({ supplierCost: 7777 });
    Object.values(r).forEach(v => {
      expect(v).toBe(parseFloat(v.toFixed(2)));
    });
  });
});

describe('calcTravel', () => {
  test('standard case: 20km at R5/km', () => {
    const r = calcTravel(20, 5);
    expect(r.travelExcl).toBe(100);
    expect(r.travelVAT).toBe(15);
    expect(r.travelTotal).toBe(115);
  });

  test('zero km produces zero travel cost', () => {
    const r = calcTravel(0, 5);
    expect(r.travelExcl).toBe(0);
    expect(r.travelVAT).toBe(0);
    expect(r.travelTotal).toBe(0);
  });

  test('passes km and ratePerKm through to result', () => {
    const r = calcTravel(25, 5.50);
    expect(r.km).toBe(25);
    expect(r.ratePerKm).toBe(5.50);
  });

  test('all amounts are rounded to 2dp', () => {
    const r = calcTravel(33, 7.77);
    Object.values(r).forEach(v => {
      expect(v).toBe(parseFloat(v.toFixed(2)));
    });
  });
});
