'use strict';

// Shapes the /api/app/staff-me response for a technician — never exposes
// supabaseUserId or invite fields, matching services/clients.js#toAppProfile.
function toTechnicianAppProfile(technician) {
  return {
    staffId: String(technician._id),
    name: technician.name,
    email: technician.email,
    phone: technician.phone,
    role: technician.role,
  };
}

module.exports = { toTechnicianAppProfile };
