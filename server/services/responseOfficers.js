'use strict';

// Shapes the /api/app/staff-me response for a response officer — never
// exposes supabaseUserId or invite fields, matching services/clients.js#toAppProfile.
function toResponseAppProfile(officer) {
  return {
    staffId: String(officer._id),
    name: officer.name,
    email: officer.email,
    phone: officer.phone,
    role: officer.role,
  };
}

module.exports = { toResponseAppProfile };
