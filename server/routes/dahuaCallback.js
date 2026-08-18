'use strict';
const express          = require('express');
const Camera           = require('../models/Camera');
const Client           = require('../models/Client');
const DahuaEventLog    = require('../models/DahuaEventLog');
const DahuaPendingBind = require('../models/DahuaPendingBind');
const dahua            = require('../services/dahua');
const { publish, broadcastToAdmins } = require('../services/realtime');
const { normalizeSAPhone } = require('../services/phone');

const router = express.Router();

// Dahua's `id` (message id) and `companyId` are 19-digit integers in every
// documented example — well past Number.MAX_SAFE_INTEGER (2^53). Express's
// default JSON.parse silently rounds them (proven live: 1685825282387133305
// becomes 1685825282387133200), which would corrupt the Ack/idempotency key
// AND make the companyId check reject every real event. Pull both straight
// off the pre-parse raw body text (stashed by index.js's express.json
// `verify` hook) instead of trusting the parsed Number.
function extractExactIntField(rawBody, fieldName) {
  if (!rawBody) return null;
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const match = text.match(new RegExp(`"${fieldName}"\\s*:\\s*(-?\\d+)`));
  return match ? match[1] : null;
}

// No requireAuth — this is called by Dahua's cloud, not an admin session.
// There's no documented inbound signature scheme for Open ARC pushes (only
// outbound calls we make to Dahua are signed), so the shared-secret path
// token is the only gate. A wrong/missing token gets a plain 404, not
// 401/403, so a scanner can't distinguish "wrong token" from "no such route".
async function callbackHandler(req, res) {
  const expected = process.env.DAHUA_CALLBACK_TOKEN;
  if (!expected || req.params.token !== expected) {
    return res.status(404).end();
  }

  const event = req.body;
  if (!event || typeof event !== 'object' || !event.msgType || event.id === undefined || event.id === null) {
    return res.status(400).json({ error: 'Malformed event' });
  }

  // Falls back to the (possibly precision-lossy) parsed value only when no
  // raw body was captured — keeps unit tests that construct req.body by hand
  // working without needing to fabricate a matching rawBody buffer.
  const dahuaMessageId = extractExactIntField(req.rawBody, 'id') || String(event.id);
  const eventCompanyId = extractExactIntField(req.rawBody, 'companyId')
    || (event.companyId !== undefined ? String(event.companyId) : undefined);

  // Defense in depth: even with a correct token, ignore anything not
  // addressed to our own ARC company.
  const expectedCompanyId = process.env.DAHUA_ARC_COMPANY_ID;
  if (expectedCompanyId && eventCompanyId !== undefined && eventCompanyId !== String(expectedCompanyId)) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  let alreadyProcessed = false;
  try {
    await DahuaEventLog.create({
      dahuaMessageId,
      msgType: event.msgType,
      deviceId: event.deviceId || '',
      channelId: typeof event.channelId === 'number' ? event.channelId : null,
      companyId: eventCompanyId || '',
      raw: event,
    });
  } catch (err) {
    if (err.code === 11000) {
      alreadyProcessed = true; // Dahua re-pushed an event we already logged
    } else {
      console.error('[dahuaCallback] failed to log event:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (!alreadyProcessed) {
    try {
      await processEvent(event, eventCompanyId);
    } catch (err) {
      // Processing failure must not block the Ack — Dahua's retry would just
      // hit the same duplicate-id short-circuit above, not re-run this.
      console.error(`[dahuaCallback] processing failed for ${event.msgType} id=${dahuaMessageId}:`, err);
    }
  }

  res.status(200).json({ ok: true });

  // Best-effort, after the response — a slow or failing Ack must never hold
  // up Dahua's own request, and a missed Ack just means a harmless re-push
  // that our DahuaEventLog dedupe already handles.
  dahua.ackMessage(dahuaMessageId).catch(err => {
    console.error(`[dahuaCallback] ackMessage failed for id=${dahuaMessageId}:`, err.message);
  });
}
router.post('/:token', callbackHandler);

async function processEvent(event, eventCompanyId) {
  if (event.msgType === 'online' || event.msgType === 'offline') {
    await processOnlineOffline(event);
  } else if (event.msgType === 'bindDevice') {
    await processBindDevice(event, eventCompanyId);
  }
  // Every other msgType (SIAEvent, picUploadResult, videoMotion, smdHuman,
  // etc.) has no consumer yet — logged via DahuaEventLog above, no action.
}

async function processOnlineOffline(event) {
  const channelId = typeof event.channelId === 'number' ? event.channelId : null;
  const camera = await Camera.findOne({ deviceSerial: event.deviceId, channelId });
  if (!camera) return; // device not provisioned as a Camera yet — nothing to update

  const wasOffline = camera.status === 'offline';
  camera.status = event.msgType;
  await camera.save();

  if (event.msgType === 'offline' && !wasOffline) {
    const payload = { cameraId: String(camera._id), name: camera.name, location: camera.location, at: new Date().toISOString() };
    publish(String(camera.clientRef), 'camera:offline', payload).catch(err => {
      console.error('[dahuaCallback] camera:offline publish failed:', err);
    });
  }
}

async function processBindDevice(event, eventCompanyId) {
  const devices = Array.isArray(event.devices) ? event.devices : [];
  for (const deviceSerial of devices) {
    if (!deviceSerial) continue;

    // Already a known device (any channel) — not a new-customer onboarding,
    // so it doesn't belong in the review queue. Just logged via DahuaEventLog.
    const existingCamera = await Camera.findOne({ deviceSerial });
    if (existingCamera) continue;

    const alreadyPending = await DahuaPendingBind.findOne({ deviceSerial, status: 'pending' });
    if (alreadyPending) continue;

    const suggestedClientRef = await suggestClient(event.ownerEmail, event.ownerTelphone);
    const pending = await DahuaPendingBind.create({
      deviceSerial,
      ownerEmail: event.ownerEmail || '',
      ownerPhone: event.ownerTelphone || '',
      companyId: eventCompanyId || '',
      suggestedClientRef,
      raw: event,
    });

    broadcastToAdmins('dahua:pendingBind', { id: String(pending._id), deviceSerial, ownerEmail: pending.ownerEmail });
  }
}

// Best-effort only — never used to auto-assign, just pre-fills the admin's
// resolve form. A mismatch just means the admin picks the right client
// manually, same as if no suggestion existed.
async function suggestClient(ownerEmail, ownerPhone) {
  const or = [];
  if (ownerEmail) or.push({ contactEmail: String(ownerEmail).toLowerCase() });
  if (ownerPhone) {
    try {
      or.push({ contactPhone: normalizeSAPhone(ownerPhone) });
    } catch {
      // not a recognizable SA number — skip the phone-based suggestion
    }
  }
  if (!or.length) return null;
  const client = await Client.findOne({ archived: false, $or: or });
  return client ? client._id : null;
}

module.exports = router;
module.exports.callbackHandler = callbackHandler;
