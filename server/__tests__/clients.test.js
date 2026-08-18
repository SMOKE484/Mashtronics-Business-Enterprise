'use strict';
const { computeClientRevenue, getClientRevenue, matchesPhone } = require('../services/clients');

const invoices = [
  { clientRef: 'a', amount: 100000 },
  { clientRef: 'a', amount: 250000 },
  { clientRef: 'b', amount: 50000 },
];

describe('computeClientRevenue', () => {
  test('groups and sums invoices per client', () => {
    const map = computeClientRevenue(invoices);
    expect(map.get('a')).toEqual({ totalInvoiced: 350000, invoiceCount: 2, largestInvoice: 250000 });
    expect(map.get('b')).toEqual({ totalInvoiced: 50000, invoiceCount: 1, largestInvoice: 50000 });
  });

  test('clients with no invoices are absent from the map', () => {
    const map = computeClientRevenue(invoices);
    expect(map.has('c')).toBe(false);
  });

  test('empty invoice list produces an empty map', () => {
    expect(computeClientRevenue([]).size).toBe(0);
  });

  test('rounds totals to 2dp', () => {
    const map = computeClientRevenue([
      { clientRef: 'x', amount: 100.111 },
      { clientRef: 'x', amount: 200.222 },
    ]);
    expect(map.get('x').totalInvoiced).toBe(300.33);
  });

  test('handles a populated clientRef doc ({ _id, name }), not just a raw id', () => {
    const map = computeClientRevenue([
      { clientRef: { _id: 'a', name: 'Client A' }, amount: 100000 },
      { clientRef: { _id: 'a', name: 'Client A' }, amount: 50000 },
    ]);
    expect(map.get('a')).toEqual({ totalInvoiced: 150000, invoiceCount: 2, largestInvoice: 100000 });
  });
});

describe('getClientRevenue', () => {
  test('returns the revenue entry for a known client', () => {
    expect(getClientRevenue(invoices, 'b')).toEqual({ totalInvoiced: 50000, invoiceCount: 1, largestInvoice: 50000 });
  });

  test('returns a zeroed entry for a client with no invoices', () => {
    expect(getClientRevenue(invoices, 'nonexistent')).toEqual({ totalInvoiced: 0, invoiceCount: 0, largestInvoice: 0 });
  });
});

describe('matchesPhone', () => {
  test('matches when the stored free-text phone normalizes to the same number', () => {
    expect(matchesPhone({ contactPhone: '+27 82 414 0291' }, '+27824140291')).toBe(true);
  });

  test('matches a locally-formatted stored number against an E.164 lookup', () => {
    expect(matchesPhone({ contactPhone: '082 414 0291' }, '+27824140291')).toBe(true);
  });

  test('does not match a different number', () => {
    expect(matchesPhone({ contactPhone: '+27 82 414 0291' }, '+27821234567')).toBe(false);
  });

  test('returns false (not throw) for a client with no contactPhone on file', () => {
    expect(matchesPhone({ contactPhone: '' }, '+27821234567')).toBe(false);
    expect(matchesPhone({}, '+27821234567')).toBe(false);
  });

  test('returns false (not throw) for a malformed stored phone', () => {
    expect(matchesPhone({ contactPhone: 'not-a-number' }, '+27821234567')).toBe(false);
  });
});
