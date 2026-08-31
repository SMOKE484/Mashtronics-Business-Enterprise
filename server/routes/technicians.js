'use strict';
const express            = require('express');
const Technician         = require('../models/Technician');
const Job                = require('../models/Job');
const { requireAuth }    = require('../middleware/auth');
const { issueInvite, deliverInviteSms } = require('../services/invites');
const { friendlySaveError } = require('../utils/mongoErrors');
const { missingFieldsForActive, describeMissingFields } = require('../services/staffActivation');
const { notifyBulkReassign } = require('../services/jobNotifications');

const router = express.Router();
router.use(requireAuth);

// GET /api/technicians
router.get('/', async (req, res) => {
  try {
    const techs = await Technician.find().sort({ name: 1 });
    res.json(techs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/technicians
async function createHandler(req, res) {
  try {
    const effective = { phone: req.body.phone, email: req.body.email, role: req.body.role, active: req.body.active === undefined ? false : req.body.active };
    if (effective.active) {
      const missing = missingFieldsForActive(effective);
      if (missing.length) return res.status(400).json({ error: describeMissingFields(missing, 'technicians') });
    }
    const tech = await Technician.create(req.body);
    res.status(201).json(tech);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'technician') });
  }
}
router.post('/', createHandler);

// PUT /api/technicians/:id
async function updateHandler(req, res) {
  try {
    const current = await Technician.findById(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });

    const effective = {
      phone: req.body.phone !== undefined ? req.body.phone : current.phone,
      email: req.body.email !== undefined ? req.body.email : current.email,
      role: req.body.role !== undefined ? req.body.role : current.role,
      active: req.body.active !== undefined ? req.body.active : current.active,
    };
    if (effective.active) {
      const missing = missingFieldsForActive(effective);
      if (missing.length) return res.status(400).json({ error: describeMissingFields(missing, 'technicians') });
    }

    const tech = await Technician.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json(tech);
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'technician') });
  }
}
router.put('/:id', updateHandler);

// DELETE /api/technicians/:id — soft delete. Also clears any SecureWatch app
// identity link (`supabaseUserId`/`appInviteCode`/`appInviteExpiresAt`) —
// otherwise a deactivated technician can permanently block a future
// technician from claiming the same Supabase identity via the
// `supabaseUserId` unique index (same class of bug found on Client, see
// BUGS_AND_FIXES.md). Uses $unset, not `$set: null` — the index is sparse,
// and a stored literal null is still indexed, so setting null here would
// just move the collision to the next deactivation.
async function deactivateHandler(req, res) {
  try {
    const tech = await Technician.findByIdAndUpdate(
      req.params.id,
      { active: false, $unset: { supabaseUserId: '', appInviteCode: '', appInviteExpiresAt: '' } },
      { new: true }
    );
    if (!tech) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id', deactivateHandler);

// GET /api/technicians/:id/jobs-count — lets the admin UI know, before a
// hard delete, whether jobs need to be reassigned or left unassigned.
async function jobsCountHandler(req, res) {
  try {
    const count = await Job.countDocuments({ technicianRef: req.params.id });
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.get('/:id/jobs-count', jobsCountHandler);

// DELETE /api/technicians/:id/permanent — hard delete. If the technician
// has jobs on record, the caller must say up front whether to reassign them
// to another technician (`reassignTo: <id>`) or leave them unassigned
// (`reassignTo: null`) — otherwise this responds 409 so the admin UI can ask.
async function hardDeleteHandler(req, res) {
  try {
    const tech = await Technician.findById(req.params.id);
    if (!tech) return res.status(404).json({ error: 'Not found' });

    const jobCount = await Job.countDocuments({ technicianRef: req.params.id });
    let reassignedTo = null;
    if (jobCount > 0) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'reassignTo')) {
        return res.status(409).json({
          error: `${tech.name} has ${jobCount} job${jobCount === 1 ? '' : 's'} assigned — choose whether to reassign them or leave them unassigned before deleting.`,
          jobCount,
        });
      }
      const { reassignTo } = req.body;
      if (reassignTo) {
        if (reassignTo === req.params.id) {
          return res.status(400).json({ error: "Can't reassign a technician's jobs to themselves." });
        }
        const target = await Technician.findById(reassignTo);
        if (!target) return res.status(400).json({ error: 'The technician to reassign jobs to was not found.' });
        await Job.updateMany({ technicianRef: req.params.id }, { $set: { technicianRef: reassignTo } });
        reassignedTo = reassignTo;
      } else {
        await Job.updateMany({ technicianRef: req.params.id }, { $unset: { technicianRef: '' } });
      }
    }

    await Technician.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
    if (reassignedTo) await notifyBulkReassign(reassignedTo, jobCount, tech.name);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id/permanent', hardDeleteHandler);

// POST /api/technicians/:id/app-invite — admin-triggered: mint an invite
// code for the technician to claim their mobile login.
async function appInviteHandler(req, res) {
  try {
    const tech = await Technician.findById(req.params.id);
    if (!tech || !tech.active) return res.status(404).json({ error: 'Not found' });
    if (tech.supabaseUserId) {
      return res.status(400).json({ error: `${tech.name} has already linked their account — they don't need a new invite code.` });
    }
    const { code, expiresAt } = await issueInvite(tech);
    const { sent, reason } = await deliverInviteSms(tech.phone, code);
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
module.exports.jobsCountHandler = jobsCountHandler;
module.exports.hardDeleteHandler = hardDeleteHandler;
module.exports.deactivateHandler = deactivateHandler;
