'use strict';
const fetch = require('node-fetch');

// Expo's push API needs no server-side SDK/credentials of our own — a bare
// HTTPS POST with the recipient's Expo push token is enough. Expo relays it
// to APNs/FCM using its own credentials.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(token, { title, body, data }) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable body>');
    throw new Error(`Expo push API responded ${res.status}: ${text}`);
  }
  const json = await res.json().catch(() => null);
  // Expo returns 200 even for a per-message rejection (e.g. an unregistered
  // device) — the actual outcome is inside data[0].status.
  const ticket = json && Array.isArray(json.data) ? json.data[0] : null;
  if (ticket && ticket.status === 'error') {
    throw new Error(`Expo push rejected: ${ticket.message || ticket.details?.error || 'unknown error'}`);
  }
}

// Best-effort notification to a staff record (Technician or ResponseOfficer
// document — both carry expoPushToken). Never throws: a push failure must
// never block the admin action that triggered it, same convention as
// deliverInviteSms in services/invites.js.
async function pushToStaff(staffDoc, { title, body, data } = {}) {
  if (!staffDoc || !staffDoc.expoPushToken) return { sent: false, reason: 'No push token on file' };
  try {
    await sendExpoPush(staffDoc.expoPushToken, { title, body, data });
    return { sent: true };
  } catch (err) {
    console.error('[pushNotifications] send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendExpoPush, pushToStaff };
