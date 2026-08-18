'use strict';

/**
 * Derives an invoice's display status. "Overdue" is never stored — it's just
 * a "sent" invoice whose due date has passed.
 */
function deriveInvoiceStatus(invoice, today = new Date()) {
  if (invoice.status === 'paid') return 'paid';
  if (new Date(invoice.dueDate) < new Date(today)) return 'overdue';
  return 'sent';
}

module.exports = { deriveInvoiceStatus };
