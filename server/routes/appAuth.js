'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const Client    = require('../models/Client');
const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');
const { linkClientAuthorization, linkStaffAuthorization } = require('../services/supabaseLinks');
const { verifySupabaseToken }     = require('../middleware/clientAuth');
const { normalizeSAPhone }        = require('../services/phone');
const { matchesPhone }            = require('../services/clients');
const { issueInvite }             = require('../services/invites');
const { sendInviteSms }           = require('../services/sms');
const { sendInviteEmail }         = require('../services/email');

const router = express.Router();

// Shared by every route in this file: extracts + verifies the Supabase
// bearer token, writing a 401 and returning null on failure so callers can
// `if (!payload) return;`.
async function verifyBearer(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  try {
    return await verifySupabaseToken(token);
  } catch (err) {
    console.error('[appAuth] token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

// POST /api/app/auth/claim — link a Supabase identity to a Client via an
// admin-issued (or self-service-requested) invite code. Requires a valid
// Supabase token (for `sub`) but not yet a linked client, so this route does
// not use requireClientAuth.
async function claimHandler(req, res) {
  const payload = await verifyBearer(req, res);
  if (!payload) return;

  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'inviteCode is required' });

  try {
    const client = await Client.findOne({
      appInviteCode: inviteCode,
      appInviteExpiresAt: { $gt: new Date() },
      archived: false,
      supabaseUserId: { $exists: false },
    });
    if (client) {
      client.supabaseUserId = payload.sub;
      client.appInviteCode = null;
      client.appInviteExpiresAt = null;
      await client.save();

      await linkClientAuthorization(payload.sub, String(client._id));

      return res.json({ ok: true });
    }

    const technician = await Technician.findOne({
      appInviteCode: inviteCode,
      appInviteExpiresAt: { $gt: new Date() },
      active: true,
      supabaseUserId: { $exists: false },
    });
    if (technician) {
      technician.supabaseUserId = payload.sub;
      technician.appInviteCode = null;
      technician.appInviteExpiresAt = null;
      await technician.save();

      await linkStaffAuthorization(payload.sub, String(technician._id), 'technician');

      return res.json({ ok: true });
    }

    const officer = await ResponseOfficer.findOne({
      appInviteCode: inviteCode,
      appInviteExpiresAt: { $gt: new Date() },
      active: true,
      supabaseUserId: { $exists: false },
    });
    if (!officer) return res.status(404).json({ error: 'Invalid or expired invite code' });

    officer.supabaseUserId = payload.sub;
    officer.appInviteCode = null;
    officer.appInviteExpiresAt = null;
    await officer.save();

    await linkStaffAuthorization(payload.sub, String(officer._id), 'response');

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

const requestInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please try again later' },
});

// Always the same shape regardless of whether a Client actually matched, so
// this endpoint can't be used to probe which phone numbers belong to real
// Mashtronics clients.
const GENERIC_RESPONSE = { ok: true, message: 'If we found a matching account, a code has been sent.' };

// POST /api/app/auth/request-invite — self-service invite delivery. The
// phone number is only a lookup key: delivery always goes to the
// contactPhone/contactEmail already on file for the matched Client, never to
// anything supplied in the request, so a caller can't redirect a real
// client's invite code to a phone/email they control.
async function requestInviteHandler(req, res) {
  const payload = await verifyBearer(req, res);
  if (!payload) return;

  const { phone, channel = 'sms' } = req.body || {};
  if (channel !== 'sms' && channel !== 'email') {
    return res.status(400).json({ error: 'channel must be "sms" or "email"' });
  }

  let normalizedPhone;
  try {
    normalizedPhone = normalizeSAPhone(phone);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    // Already-linked clients are deliberately excluded from the match: they
    // don't need a code (they just sign in), and matching them here is what
    // caused an unrelated fresh invite code + SMS to fire every time someone
    // else's phone number happened to coincide (see BUGS_AND_FIXES.md).
    const candidates = await Client.find({ archived: false, supabaseUserId: { $exists: false } });
    const client = candidates.find((c) => matchesPhone(c, normalizedPhone));
    if (!client) return res.json(GENERIC_RESPONSE);

    const { code } = await issueInvite(client);

    try {
      if (channel === 'email') {
        if (!client.contactEmail) throw new Error('No contact email on file for this client');
        await sendInviteEmail(client.contactEmail, code);
      } else {
        await sendInviteSms(normalizeSAPhone(client.contactPhone), code);
      }
    } catch (sendErr) {
      // Code was generated and is valid — admin can still hand it out
      // manually. Don't leak delivery failure to the caller (same
      // anti-enumeration reasoning as above).
      console.error('[appAuth/request-invite] delivery failed:', sendErr.message);
    }

    res.json(GENERIC_RESPONSE);
  } catch (err) {
    console.error('[appAuth/request-invite] failed:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

router.post('/claim', claimHandler);
router.post('/request-invite', requestInviteLimiter, requestInviteHandler);

module.exports = router;
module.exports.claimHandler = claimHandler;
module.exports.requestInviteHandler = requestInviteHandler;
