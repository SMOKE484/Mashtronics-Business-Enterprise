'use strict';
const { normalizeSAPhone } = require('./phone');

function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Groups invoices by clientRef and computes revenue totals per client.
 * Never stored on Client — always computed live so the numbers shown on the
 * Clients screen, the Dashboard, and a client's own detail view can never disagree.
 */
function computeClientRevenue(invoices = []) {
  const map = new Map();
  for (const inv of invoices) {
    // clientRef may be a raw ObjectId or a populated { _id, name } doc.
    const key = String((inv.clientRef && inv.clientRef._id) || inv.clientRef);
    const cur = map.get(key) || { totalInvoiced: 0, invoiceCount: 0, largestInvoice: 0 };
    cur.totalInvoiced = r2(cur.totalInvoiced + inv.amount);
    cur.invoiceCount += 1;
    cur.largestInvoice = Math.max(cur.largestInvoice, inv.amount);
    map.set(key, cur);
  }
  return map;
}

function getClientRevenue(invoices, clientId) {
  return computeClientRevenue(invoices).get(String(clientId)) || { totalInvoiced: 0, invoiceCount: 0, largestInvoice: 0 };
}

/**
 * Shapes a Client doc for the SecureWatch app (`GET /api/app/me`).
 * clientId doubles as the app's Supabase Realtime channel name
 * (`client:<clientId>`) — the app has no other way to learn it.
 * Never expose supabaseUserId, invite fields, notes, or scopeOfWork.
 */
function toAppProfile(client) {
  return {
    clientId: String(client._id),
    name: client.name,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    billingAddress: client.billingAddress,
    clientSince: client.clientSince,
  };
}

/**
 * True if `client.contactPhone` (stored as free-text by admins — e.g.
 * "+27 82 414 0291" with spaces) normalizes to the same E.164 number as
 * `normalizedPhone`. Used for self-service invite lookup, where an exact
 * DB-level string match on contactPhone can't be relied on. Never throws —
 * a client with a missing/malformed stored number just doesn't match.
 */
function matchesPhone(client, normalizedPhone) {
  if (!client.contactPhone) return false;
  try {
    return normalizeSAPhone(client.contactPhone) === normalizedPhone;
  } catch {
    return false;
  }
}

module.exports = { computeClientRevenue, getClientRevenue, toAppProfile, matchesPhone };
