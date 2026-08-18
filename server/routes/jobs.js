'use strict';
const express         = require('express');
const Job             = require('../models/Job');
const Counter         = require('../models/Counter');
const { requireAuth } = require('../middleware/auth');
const { friendlySaveError } = require('../utils/mongoErrors');
const { checklistForJobType } = require('../services/jobChecklists');
const { notifyTechnicianOfJob, notifyTechnicianJobRemoved } = require('../services/jobNotifications');

const router = express.Router();
router.use(requireAuth);

const JOB_STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

// GET /api/jobs?from=&to=&clientId=
router.get('/', async (req, res) => {
  try {
    const { from, to, clientId } = req.query;
    const filter = {};
    if (clientId) filter.clientRef = clientId;
    if (from || to) {
      filter.scheduledDate = {};
      if (from) filter.scheduledDate.$gte = new Date(from);
      if (to) filter.scheduledDate.$lte = new Date(to);
    }
    const jobs = await Job.find(filter)
      .sort({ scheduledDate: 1 })
      .populate('clientRef', 'name')
      .populate('technicianRef', 'name');
    res.json(jobs);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('clientRef', 'name').populate('technicianRef', 'name');
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json(job);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/jobs
async function createHandler(req, res) {
  try {
    const counter = await Counter.findOneAndUpdate(
      { name: 'jobNumber' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    const body = { ...req.body, jobNumber: `J${counter.seq}` };
    if (!Array.isArray(body.checklist) || body.checklist.length === 0) {
      body.checklist = checklistForJobType(body.jobType);
    }
    const job = await Job.create(body);
    res.status(201).json(job);
    if (job.technicianRef) {
      await notifyTechnicianOfJob(job._id, job.technicianRef, { isNewAssignment: true });
    }
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}
router.post('/', createHandler);

// PUT /api/jobs/:id
async function updateHandler(req, res) {
  try {
    // Admin edits must never wipe technician-recorded proof-of-work; status
    // changes go through the dedicated PATCH. Checklist/parts DO pass through —
    // that is the admin edit path for them.
    const { jobNumber, photos, signature, startedAt, completedAt, status, ...updates } = req.body;
    const before = await Job.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const prevTechId = before.technicianRef ? String(before.technicianRef) : null;

    const job = await Job.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json(job);

    const nextTechId = job.technicianRef ? String(job.technicianRef) : null;
    if (nextTechId === prevTechId) {
      if (nextTechId) await notifyTechnicianOfJob(job._id, nextTechId, { isNewAssignment: false });
    } else {
      if (prevTechId) await notifyTechnicianJobRemoved(job._id, prevTechId);
      if (nextTechId) await notifyTechnicianOfJob(job._id, nextTechId, { isNewAssignment: true });
    }
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}
router.put('/:id', updateHandler);

// DELETE /api/jobs/:id
async function deleteHandler(req, res) {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.delete('/:id', deleteHandler);

// PATCH /api/jobs/:id/status
async function statusHandler(req, res) {
  const { status } = req.body;
  if (!JOB_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Not found' });
    job.status = status;
    // Keep admin-driven status changes coherent with technician History
    // durations — stamp only if the technician app hasn't already.
    if (status === 'In Progress' && !job.startedAt) job.startedAt = new Date();
    if (status === 'Completed' && !job.completedAt) job.completedAt = new Date();
    await job.save();
    res.json(job);
    if (job.technicianRef) {
      await notifyTechnicianOfJob(job._id, job.technicianRef, { isNewAssignment: false });
    }
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
router.patch('/:id/status', statusHandler);

module.exports = router;
module.exports.createHandler = createHandler;
module.exports.updateHandler = updateHandler;
module.exports.deleteHandler = deleteHandler;
module.exports.statusHandler = statusHandler;
