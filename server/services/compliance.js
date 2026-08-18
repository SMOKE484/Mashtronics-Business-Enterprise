'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_THRESHOLD_DAYS = 60;

function daysBetween(a, b) {
  return Math.ceil((new Date(b) - new Date(a)) / MS_PER_DAY);
}

/**
 * Derives a compliance document's display status from its expiry date.
 * Never stored — always computed against "today" so it can't go stale.
 */
function deriveComplianceStatus(expiryDate, today = new Date(), thresholdDays = EXPIRING_SOON_THRESHOLD_DAYS) {
  const daysRemaining = daysBetween(today, expiryDate);

  if (daysRemaining < 0) {
    return { status: 'Expired', daysRemaining, note: `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago — renew immediately` };
  }
  if (daysRemaining <= thresholdDays) {
    return { status: 'Expiring Soon', daysRemaining, note: `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` };
  }
  return { status: 'Valid', daysRemaining, note: `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` };
}

module.exports = { deriveComplianceStatus, EXPIRING_SOON_THRESHOLD_DAYS };
