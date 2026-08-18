'use strict';

// A technician/response officer can only be active once phone, email, and
// role are all filled in — shared by both models since they have identical
// shapes and the same activation rule.
const REQUIRED_FOR_ACTIVE = ['phone', 'email', 'role'];

function missingFieldsForActive(staff) {
  return REQUIRED_FOR_ACTIVE.filter((field) => !staff[field] || !String(staff[field]).trim());
}

function describeMissingFields(missing, label) {
  const verb = missing.length > 1 ? 'are' : 'is';
  return `Active ${label} need phone, email, and role filled in — ${missing.join(', ')} ${verb} missing.`;
}

module.exports = { missingFieldsForActive, describeMissingFields };
