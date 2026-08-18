'use strict';
const fetch = require('node-fetch');

// Upserts the minimal client_links row Supabase Realtime Authorization needs
// to resolve auth.uid() -> allowed `client:<id>` topic. This is the one
// narrow exception to "Supabase never holds business data" — see
// features.md Track C. No-ops quietly if Supabase isn't configured yet.
async function linkClientAuthorization(supabaseUserId, clientId) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/client_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ supabase_user_id: supabaseUserId, client_id: clientId }),
    });
  } catch {
    // Best-effort — the MongoDB link (source of truth) already succeeded.
  }
}

// Staff-side sibling of linkClientAuthorization: upserts the staff_links row
// that Supabase storage RLS (job-photos uploads) — and, later, staff realtime
// topics — need to resolve auth.uid() -> a Mashtronics staff identity.
async function linkStaffAuthorization(supabaseUserId, staffId, staffType) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/staff_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ supabase_user_id: supabaseUserId, staff_id: staffId, staff_type: staffType }),
    });
  } catch {
    // Best-effort — the MongoDB link (source of truth) already succeeded.
  }
}

module.exports = { linkClientAuthorization, linkStaffAuthorization };
