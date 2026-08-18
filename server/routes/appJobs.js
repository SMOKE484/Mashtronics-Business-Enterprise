'use strict';
const express  = require('express');
const mongoose = require('mongoose');
const Job      = require('../models/Job');
const { requireTechnicianAuth } = require('../middleware/staffAuth');
const { toAppJob }              = require('../services/jobs');
const { objectExists, deleteObject } = require('../services/storage');
const { friendlySaveError } = require('../utils/mongoErrors');

// Technician-facing jobs API. Everything is scoped to the authenticated
// technician; a job that exists but belongs to someone else 404s exactly like
// one that doesn't exist (same don't-leak convention as appCameras).

const router = express.Router();
router.use(requireTechnicianAuth);

const CLIENT_FIELDS = 'name billingAddress contactPhone';
const MAX_PHOTOS = 12;
// Signature payload limits: SVG path strings drawn on the phone, downsampled
// client-side. Cap well under the 16kb express.json limit.
const SIGNATURE_MAX_CHARS = 12000;
const SVG_PATH_RE = /^[MLmlZz0-9 .,-]+$/;

// Finds a job owned by this technician or writes a 404 and returns null.
// Invalid ObjectIds 404 too (not 500-via-CastError).
async function findOwnJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const job = await Job.findOne({ _id: req.params.id, technicianRef: req.technician._id })
    .populate('clientRef', CLIENT_FIELDS);
  if (!job) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return job;
}

// GET /api/app/jobs — every active job assigned to this technician (past-due,
// today, and future — no day-bounds filter), earliest scheduled first.
// Completed/cancelled jobs never appear here; History is their home.
async function listHandler(req, res) {
  try {
    const jobs = await Job.find({
      technicianRef: req.technician._id,
      status: { $in: ['Scheduled', 'In Progress'] },
    })
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .populate('clientRef', CLIENT_FIELDS);
    res.json(await Promise.all(jobs.map((j) => toAppJob(j))));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/app/jobs/history
async function historyHandler(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const jobs = await Job.find({ technicianRef: req.technician._id, status: 'Completed' })
      .sort({ completedAt: -1 })
      .limit(limit)
      .populate('clientRef', CLIENT_FIELDS);
    res.json(await Promise.all(jobs.map((j) => toAppJob(j))));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/app/jobs/stats — the two Profile tiles.
async function statsHandler(req, res) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [completedThisWeek, completedTotal] = await Promise.all([
      Job.countDocuments({ technicianRef: req.technician._id, status: 'Completed', completedAt: { $gte: weekAgo } }),
      Job.countDocuments({ technicianRef: req.technician._id, status: 'Completed' }),
    ]);
    res.json({ completedThisWeek, completedTotal });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/app/jobs/:id — full detail with signed photo URLs.
async function detailHandler(req, res) {
  try {
    const job = await findOwnJob(req, res);
    if (!job) return;
    res.json(await toAppJob(job, { withUrls: true }));
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

// PATCH /api/app/jobs/:id/start
async function startHandler(req, res) {
  try {
    const job = await findOwnJob(req, res);
    if (!job) return;
    if (job.status === 'Completed') return res.status(409).json({ error: 'This job is already completed' });
    if (job.status === 'Cancelled') return res.status(409).json({ error: 'This job was cancelled' });
    if (job.status === 'Scheduled') {
      job.status = 'In Progress';
      if (!job.startedAt) job.startedAt = new Date();
      await job.save();
    }
    // Already In Progress falls through — idempotent, safe to retry.
    res.json(await toAppJob(job, { withUrls: true }));
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}

// PATCH /api/app/jobs/:id/checklist/:index — body { done }. An explicit set
// (not a toggle) so retries are idempotent.
async function checklistHandler(req, res) {
  try {
    const job = await findOwnJob(req, res);
    if (!job) return;
    if (job.status === 'Scheduled') return res.status(409).json({ error: 'Start the job first' });
    if (job.status !== 'In Progress') return res.status(409).json({ error: 'This job is already completed' });

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= job.checklist.length) {
      return res.status(400).json({ error: 'Invalid checklist item' });
    }
    if (typeof req.body.done !== 'boolean') {
      return res.status(400).json({ error: 'done must be true or false' });
    }
    job.checklist[index].done = req.body.done;
    await job.save();
    res.json(await toAppJob(job, { withUrls: true }));
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}

// POST /api/app/jobs/:id/photos — body { path }. The phone uploads directly
// to Supabase Storage, then records the object path here. The server is the
// authority on what counts: the path must sit under THIS technician's uid
// folder and THIS job's id, and the object must actually exist.
async function addPhotoHandler(req, res) {
  try {
    const job = await findOwnJob(req, res);
    if (!job) return;
    if (job.status !== 'In Progress') {
      return res.status(409).json({ error: job.status === 'Scheduled' ? 'Start the job first' : 'This job is already completed' });
    }
    if (job.photos.length >= MAX_PHOTOS) {
      return res.status(400).json({ error: `A job can have at most ${MAX_PHOTOS} photos` });
    }

    const path = typeof req.body.path === 'string' ? req.body.path : '';
    const requiredPrefix = `${req.supabaseUserId}/jobs/${job._id}/`;
    const fileName = path.slice(requiredPrefix.length);
    if (!path.startsWith(requiredPrefix) || !/^[\w.-]+$/.test(fileName)) {
      return res.status(400).json({ error: 'Invalid photo path' });
    }
    if (job.photos.some((p) => p.path === path)) {
      return res.status(400).json({ error: 'That photo is already attached' });
    }
    if (!(await objectExists(path))) {
      return res.status(400).json({ error: "That photo didn't finish uploading — try again" });
    }

    job.photos.push({ path });
    await job.save();
    res.json(await toAppJob(job, { withUrls: true }));
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}

// DELETE /api/app/jobs/:id/photos/:index
async function removePhotoHandler(req, res) {
  try {
    const job = await findOwnJob(req, res);
    if (!job) return;
    if (job.status !== 'In Progress') {
      return res.status(409).json({ error: 'Photos can only be changed while the job is in progress' });
    }
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= job.photos.length) {
      return res.status(400).json({ error: 'Invalid photo' });
    }
    const [removed] = job.photos.splice(index, 1);
    await job.save();
    // Best-effort cleanup; the Mongo array is the source of truth.
    deleteObject(removed.path);
    res.json(await toAppJob(job, { withUrls: true }));
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}

function validSignature(signature) {
  if (!signature || !Array.isArray(signature.svgPaths) || signature.svgPaths.length === 0) return false;
  if (!signature.svgPaths.every((p) => typeof p === 'string' && p.length > 0 && SVG_PATH_RE.test(p))) return false;
  if (signature.svgPaths.join('').length > SIGNATURE_MAX_CHARS) return false;
  return true;
}

// POST /api/app/jobs/:id/complete — body { signature }. Server-authoritative
// sign-off gates; the app mirrors these for instant UX but this is the truth.
async function completeHandler(req, res) {
  try {
    const job = await findOwnJob(req, res);
    if (!job) return;
    if (job.status === 'Completed') return res.status(409).json({ error: 'This job is already completed' });
    if (job.status !== 'In Progress') {
      return res.status(409).json({ error: job.status === 'Cancelled' ? 'This job was cancelled' : 'Start the job first' });
    }

    const done = job.checklist.filter((i) => i.done).length;
    if (done < job.checklist.length) {
      return res.status(409).json({ error: `Only ${done}/${job.checklist.length} tasks are complete — finish the checklist first` });
    }
    if (job.photos.length < 1) {
      return res.status(409).json({ error: 'Add at least one proof-of-work photo before completing' });
    }

    const { signature } = req.body || {};
    if (!validSignature(signature)) {
      return res.status(400).json({ error: 'A customer signature is required to complete the job' });
    }

    job.signature = {
      svgPaths: signature.svgPaths,
      viewWidth: Number(signature.viewWidth) || 0,
      viewHeight: Number(signature.viewHeight) || 0,
      capturedAt: new Date(),
    };
    job.status = 'Completed';
    job.completedAt = new Date();
    await job.save();
    res.json(await toAppJob(job, { withUrls: true }));
  } catch (err) {
    res.status(400).json({ error: friendlySaveError(err, 'job') });
  }
}

router.get('/', listHandler);
router.get('/history', historyHandler);
router.get('/stats', statsHandler);
router.get('/:id', detailHandler);
router.patch('/:id/start', startHandler);
router.patch('/:id/checklist/:index', checklistHandler);
router.post('/:id/photos', addPhotoHandler);
router.delete('/:id/photos/:index', removePhotoHandler);
router.post('/:id/complete', completeHandler);

module.exports = router;
module.exports.listHandler = listHandler;
module.exports.historyHandler = historyHandler;
module.exports.statsHandler = statsHandler;
module.exports.detailHandler = detailHandler;
module.exports.startHandler = startHandler;
module.exports.checklistHandler = checklistHandler;
module.exports.addPhotoHandler = addPhotoHandler;
module.exports.removePhotoHandler = removePhotoHandler;
module.exports.completeHandler = completeHandler;
module.exports.SIGNATURE_MAX_CHARS = SIGNATURE_MAX_CHARS;
module.exports.MAX_PHOTOS = MAX_PHOTOS;
