'use strict';
const Technician = require('../models/Technician');
const ResponseOfficer = require('../models/ResponseOfficer');
const { verifySupabaseToken } = require('./clientAuth');

// Shared by every staff-auth middleware below: extracts + verifies the
// Supabase bearer token, writing a 401 and returning null on failure so
// callers can `if (!payload) return;`.
async function getBearerPayload(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  try {
    return await verifySupabaseToken(token);
  } catch (err) {
    console.error('[staffAuth] token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

function requireModelAuth(Model, reqKey, unlinkedMessage) {
  return async function (req, res, next) {
    const payload = await getBearerPayload(req, res);
    if (!payload) return;
    try {
      const doc = await Model.findOne({ supabaseUserId: payload.sub, active: true });
      if (!doc) return res.status(401).json({ error: unlinkedMessage });
      req[reqKey] = doc;
      req.supabaseUserId = payload.sub;
      next();
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  };
}

const requireTechnicianAuth = requireModelAuth(Technician, 'technician', 'No linked technician account');
const requireResponseAuth = requireModelAuth(ResponseOfficer, 'officer', 'No linked response account');

// Combined resolver for the single /api/app/staff-me endpoint: tries
// Technician, then ResponseOfficer. Kept separate from the two middlewares
// above (not just an "OR" of their error messages) so the mobile app only
// ever needs to distinguish client-unlinked vs staff-unlinked, not three ways.
async function requireEitherStaffAuth(req, res, next) {
  const payload = await getBearerPayload(req, res);
  if (!payload) return;
  try {
    const technician = await Technician.findOne({ supabaseUserId: payload.sub, active: true });
    if (technician) {
      req.staffType = 'technician';
      req.staff = technician;
      req.supabaseUserId = payload.sub;
      return next();
    }
    const officer = await ResponseOfficer.findOne({ supabaseUserId: payload.sub, active: true });
    if (officer) {
      req.staffType = 'response';
      req.staff = officer;
      req.supabaseUserId = payload.sub;
      return next();
    }
    res.status(401).json({ error: 'No linked staff account' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { requireTechnicianAuth, requireResponseAuth, requireEitherStaffAuth };
