'use strict';
const crypto = require('crypto');
const { normalizeSAPhone } = require('./phone');
const { sendInviteSms } = require('./sms');

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateInviteCode() {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  return { code, expiresAt };
}

// Assigns a fresh invite code to a Client document and persists it. Shared by
// the admin-triggered route (clients.js) and the self-service app route
// (appAuth.js) so there is exactly one place invite codes are minted.
async function issueInvite(client) {
  const { code, expiresAt } = generateInviteCode();
  client.appInviteCode = code;
  client.appInviteExpiresAt = expiresAt;
  await client.save();
  return { code, expiresAt };
}

// Best-effort SMS delivery for an admin-issued invite code. Never throws —
// the code is always valid regardless of delivery outcome, so a failed send
// degrades to "share it manually" rather than blocking the invite flow.
async function deliverInviteSms(phoneRaw, code) {
  if (!phoneRaw) {
    return { sent: false, reason: 'No phone number on file for this record.' };
  }

  let normalized;
  try {
    normalized = normalizeSAPhone(phoneRaw);
  } catch (err) {
    return { sent: false, reason: err.message };
  }

  try {
    await sendInviteSms(normalized, code);
    return { sent: true };
  } catch (err) {
    console.error('[invites] SMS delivery failed:', err.message);
    return { sent: false, reason: "Couldn't send the SMS — share the code manually." };
  }
}

module.exports = { generateInviteCode, issueInvite, deliverInviteSms, INVITE_TTL_MS };
