'use strict';
const express            = require('express');
const ResponseOfficer    = require('../models/ResponseOfficer');
const { requireAuth }    = require('../middleware/auth');
const { issueInvite, deliverInviteSms } = require('../services/invites');
const { friendlySaveError } = require('../utils/mongoErrors');
const { missingFieldsForActive, describeMissingFields } = require('../services/staffActivation');

const router = express.Router();
router.use(requireAuth);

// GET /api/response-officers
router.get('/', async (req, res) => {
  try {
    const officers = await ResponseOfficer.find().sort({ name: 1 });
    res.json(officers);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/response-officers
async function createHandler(req, res) {
  try {
    const effective = { phone: req.body.phone, email: req.body.email, role: req.body.role, active: req.body.active === undefined ? false : req.body.active };
    if (effective.active) {
      const missing = missingFieldsForActive(effective);
      if (missing.length) return res.status(400).json({ error: describeMissingFields(missing, 'response officers') });
    }
    const officer = await ResponseOfficer.create(req.body);
    res.status(201).json(officer);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'response officer') });
  }
}
router.post('/', createHandler);

// PUT /api/response-officers/:id
async function updateHandler(req, res) {
  try {
    const current = await ResponseOfficer.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });

    const effective = {
      phone: req.body.phone !== undefined ? req.body.phone : current.phone,
      email: req.body.email !== undefined ? req.body.email : current.email,
      role: req.body.role !== undefined ? req.body.role : current.role,
      active: req.body.active !== undefined ? req.body.active : current.active,
    };
    if (effective.active) {
      const missing = missingFieldsForActive(effective);
      if (missing.length) return res.status(400).json({ error: describeMissingFields(missing, 'response officers') });
    }

    const officer = await ResponseOfficer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(officer);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'response officer') });
  }
}
router.put('/:id', updateHandler);

// DELETE /api/response-officers/:id — soft delete. Also clears any
// SecureWatch app identity link (`supabaseUserId`/`appInviteCode`/
// `appInviteExpiresAt`) — otherwise a deactivated officer can permanently
// block a future officer from claiming the same Supabase identity via the
// `supabaseUserId` unique index (same class of bug found on Client, see
// BUGS_AND_FIXES.md). Uses $unset, not `$set: null` — the index is sparse,
// and a stored literal null is still indexed, so setting null here would
// just move the collision to the next deactivation.
async function deactivateHandler(req, res) {
  try {
    const officer = await ResponseOfficer.findByIdAndUpdate(
      req.params.id,
      { active: false, $unset: { supabaseUserId: '', appInviteCode: '', appInviteExpiresAt: '' } },
      { new: true }
    );
    if (!officer) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id', deactivateHandler);

// DELETE /api/response-officers/:id/permanent — hard delete. Nothing else
// in the schema references a response officer yet (no panic-dispatch
// assignment field exists), so this needs no reassignment step.
async function hardDeleteHandler(req, res) {
  try {
    const officer = await ResponseOfficer.findByIdAndDelete(req.params.id);
    if (!officer) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id/permanent', hardDeleteHandler);

// POST /api/response-officers/:id/app-invite — admin-triggered: mint an
// invite code for the officer to claim their mobile login.
async function appInviteHandler(req, res) {
  try {
    const officer = await ResponseOfficer.findById(req.params.id);
    if (!officer || !officer.active) return res.status(404).json({ error: 'Not found' });
    if (officer.supabaseUserId) {
      return res.status(400).json({ error: `${officer.name} has already linked their account — they don't need a new invite code.` });
    }
    const { code, expiresAt } = await issueInvite(officer);
    const { sent, reason } = await deliverInviteSms(officer.phone, code);
    res.json({ inviteCode: code, expiresAt, smsSent: sent, smsError: sent ? undefined : reason });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.post('/:id/app-invite', appInviteHandler);

module.exports = router;
module.exports.appInviteHandler = appInviteHandler;
module.exports.createHandler = createHandler;
module.exports.updateHandler = updateHandler;
module.exports.hardDeleteHandler = hardDeleteHandler;
module.exports.deactivateHandler = deactivateHandler;
