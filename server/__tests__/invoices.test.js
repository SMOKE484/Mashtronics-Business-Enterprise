'use strict';
const { deriveInvoiceStatus } = require('../services/invoices');

describe('deriveInvoiceStatus', () => {
  const today = new Date('2026-07-09T00:00:00Z');

  test('paid invoice is always paid, regardless of due date', () => {
    const r = deriveInvoiceStatus({ status: 'paid', dueDate: '2026-01-01' }, today);
    expect(r).toBe('paid');
  });

  test('sent invoice past its due date is overdue', () => {
    const r = deriveInvoiceStatus({ status: 'sent', dueDate: '2026-07-01' }, today);
    expect(r).toBe('overdue');
  });

  test('sent invoice not yet due is sent', () => {
    const r = deriveInvoiceStatus({ status: 'sent', dueDate: '2026-07-20' }, today);
    expect(r).toBe('sent');
  });

  test('sent invoice due exactly today is not overdue', () => {
    const r = deriveInvoiceStatus({ status: 'sent', dueDate: '2026-07-09' }, today);
    expect(r).toBe('sent');
  });
});
