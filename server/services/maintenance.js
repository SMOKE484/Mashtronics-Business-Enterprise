'use strict';

/**
 * Derives a maintenance contract's display status.
 * `active:false` (stored) always wins — a date alone can't tell us a contract ended.
 */
function deriveContractStatus(contract, today = new Date()) {
  if (!contract.active) return 'Contract ended';
  if (new Date(contract.nextVisit) < new Date(today)) return 'Overdue';
  return 'Upcoming';
}

module.exports = { deriveContractStatus };
