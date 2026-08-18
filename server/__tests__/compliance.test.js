'use strict';
const { deriveComplianceStatus } = require('../services/compliance');

describe('deriveComplianceStatus', () => {
  const today = new Date('2026-07-09T00:00:00Z');

  test('expiry more than 60 days out is Valid', () => {
    const r = deriveComplianceStatus('2027-01-10T00:00:00Z', today);
    expect(r.status).toBe('Valid');
    expect(r.daysRemaining).toBeGreaterThan(60);
  });

  test('expiry within 60 days is Expiring Soon', () => {
    // 2026-07-09 + 52 days = 2026-08-30
    const r = deriveComplianceStatus('2026-08-30T00:00:00Z', today);
    expect(r.status).toBe('Expiring Soon');
    expect(r.daysRemaining).toBe(52);
    expect(r.note).toBe('Expires in 52 days');
  });

  test('expiry exactly at the 60 day threshold is Expiring Soon', () => {
    const r = deriveComplianceStatus('2026-09-07T00:00:00Z', today);
    expect(r.daysRemaining).toBe(60);
    expect(r.status).toBe('Expiring Soon');
  });

  test('expiry in the past is Expired', () => {
    // 2026-07-09 - 8 days = 2026-07-01
    const r = deriveComplianceStatus('2026-07-01T00:00:00Z', today);
    expect(r.status).toBe('Expired');
    expect(r.daysRemaining).toBe(-8);
    expect(r.note).toBe('Expired 8 days ago — renew immediately');
  });

  test('custom threshold is respected', () => {
    const r = deriveComplianceStatus('2026-08-30T00:00:00Z', today, 30);
    expect(r.status).toBe('Valid');
  });
});
