'use strict';
const fetch = require('node-fetch');

// Admin dashboard gets live updates over SSE (cookie-authenticated, no
// Supabase involvement). Mobile app gets the same events via a Supabase
// Realtime broadcast on a per-client private channel. MongoDB is always
// written first by the caller — this module is transport only.

const adminClients = new Set();

function addAdminClient(res) {
  adminClients.add(res);
}

function removeAdminClient(res) {
  adminClients.delete(res);
}

function broadcastToAdmins(event, payload) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of adminClients) {
    res.write(frame);
  }
}

async function broadcastToClient(clientId, event, payload) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `client:${clientId}`, event, payload, private: true }],
      }),
    });
    // node-fetch does not throw on 4xx/5xx, so a Supabase rejection would
    // otherwise pass through this function completely silently.
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable body>');
      console.error(`[realtime] broadcastToClient FAILED status=${res.status} clientId=${clientId} event=${event} body=${body}`);
    }
  } catch (err) {
    console.error(`[realtime] broadcastToClient THREW clientId=${clientId} event=${event}`, err);
  }
}

async function publish(clientId, event, payload) {
  broadcastToAdmins(event, payload);
  await broadcastToClient(clientId, event, payload);
}

// Staff-side sibling of broadcastToClient — private topic `staff:<id>`,
// authorized via the staff_links table (see supabase-realtime.sql). Used for
// live job updates on the technician app; no admin-SSE fan-out needed here
// since the admin dashboard already has its own Jobs list refresh.
async function broadcastToStaff(staffId, event, payload) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ topic: `staff:${staffId}`, event, payload, private: true }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable body>');
      console.error(`[realtime] broadcastToStaff FAILED status=${res.status} staffId=${staffId} event=${event} body=${body}`);
    }
  } catch (err) {
    console.error(`[realtime] broadcastToStaff THREW staffId=${staffId} event=${event}`, err);
  }
}

module.exports = {
  addAdminClient, removeAdminClient, broadcastToAdmins, broadcastToClient, broadcastToStaff, publish,
};
