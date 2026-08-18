'use strict';
const { deriveContractStatus } = require('../services/maintenance');

describe('deriveContractStatus', () => {
  const today = new Date('2026-07-09T00:00:00Z');

  test('inactive contract is always Contract ended, even with a future visit date', () => {
    const r = deriveContractStatus({ active: false, nextVisit: '2026-12-01' }, today);
    expect(r).toBe('Contract ended');
  });

  test('active contract with a past next-visit date is Overdue', () => {
    const r = deriveContractStatus({ active: true, nextVisit: '2026-07-05' }, today);
    expect(r).toBe('Overdue');
  });

  test('active contract with a future next-visit date is Upcoming', () => {
    const r = deriveContractStatus({ active: true, nextVisit: '2026-08-02' }, today);
    expect(r).toBe('Upcoming');
  });
});
