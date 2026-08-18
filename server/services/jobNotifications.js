'use strict';
const Job        = require('../models/Job');
const Technician  = require('../models/Technician');
const { toAppJob } = require('./jobs');
const { broadcastToStaff } = require('./realtime');
const { pushToStaff }      = require('./pushNotifications');

// Keeps a technician's live Jobs screen (and, for a fresh assignment, their
// phone's lock screen) in sync with admin-side job changes. Every function
// here is best-effort and never throws — a notification failure must never
// break the admin action that triggered it (same never-block convention as
// triggerAiReply in routes/appMessages.js).

const CLIENT_FIELDS = 'name billingAddress contactPhone';

// Pushes the job's current app-shaped state to the assigned technician's
// live Jobs screen, and — only for a fresh assignment, not every field
// edit — a push notification.
async function notifyTechnicianOfJob(jobId, technicianId, { isNewAssignment }) {
  try {
    const job = await Job.findById(jobId).populate('clientRef', CLIENT_FIELDS);
    if (!job) return;
    const appJob = await toAppJob(job);
    await broadcastToStaff(technicianId, 'job:upsert', appJob);
    if (isNewAssignment) {
      const tech = await Technician.findById(technicianId);
      await pushToStaff(tech, {
        title: 'New job assigned',
        body: appJob.client ? `${appJob.jobType} — ${appJob.client}` : appJob.jobType,
        data: { jobId: appJob.id },
      });
    }
  } catch (err) {
    console.error('[jobNotifications] notifyTechnicianOfJob failed:', err.message);
  }
}

// Tells a technician's live Jobs screen a job is no longer theirs
// (reassigned away, or unassigned outright). No push — losing a job isn't
// something that needs to interrupt someone's day.
async function notifyTechnicianJobRemoved(jobId, technicianId) {
  try {
    await broadcastToStaff(technicianId, 'job:remove', { id: String(jobId) });
  } catch (err) {
    console.error('[jobNotifications] notifyTechnicianJobRemoved failed:', err.message);
  }
}

// Tells the technician who just inherited a bulk reassignment (from a
// deleted colleague) to refresh their Jobs list, plus one aggregate push
// rather than one per job (avoids a notification flood).
async function notifyBulkReassign(technicianId, jobCount, fromName) {
  try {
    await broadcastToStaff(technicianId, 'jobs:refresh', {});
    const target = await Technician.findById(technicianId);
    await pushToStaff(target, {
      title: 'Jobs reassigned to you',
      body: `${jobCount} job${jobCount === 1 ? '' : 's'} previously assigned to ${fromName} ${jobCount === 1 ? 'is' : 'are'} now yours.`,
    });
  } catch (err) {
    console.error('[jobNotifications] notifyBulkReassign failed:', err.message);
  }
}

module.exports = { notifyTechnicianOfJob, notifyTechnicianJobRemoved, notifyBulkReassign };
