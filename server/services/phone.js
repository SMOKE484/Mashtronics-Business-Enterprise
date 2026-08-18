'use strict';

// Validates and normalizes South African phone numbers to E.164 (+27XXXXXXXXX).
// Format-only validation (9 national digits, not starting with 0) — does not
// check against real carrier/area-code ranges.
const SA_NATIONAL_RE = /^[1-9]\d{8}$/;

function normalizeSAPhone(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Phone number is required');
  }

  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');

  let national;
  if (hasPlus && digits.startsWith('27')) {
    national = digits.slice(2);
  } else if (!hasPlus && digits.startsWith('27') && digits.length === 11) {
    national = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 10) {
    national = digits.slice(1);
  } else if (digits.length === 9) {
    national = digits;
  } else {
    throw new Error('Enter a valid South African phone number, e.g. 082 123 4567');
  }

  if (!SA_NATIONAL_RE.test(national)) {
    throw new Error('Enter a valid South African phone number, e.g. 082 123 4567');
  }

  return `+27${national}`;
}

module.exports = { normalizeSAPhone };
