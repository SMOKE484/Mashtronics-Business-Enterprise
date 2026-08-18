'use strict';
const { createSignedUrls } = require('./storage');

// Shapers + pure date helpers for the technician-facing jobs API
// (server/routes/appJobs.js). Pure except toAppJob's optional signed-URL
// minting; no DB calls, same convention as pricing.js.

// Admin statuses -> the app vocabulary the SecureWatch mockups use.
const APP_STATUS = {
  Scheduled: 'upcoming',
  'In Progress': 'in-progress',
  Completed: 'done',
  Cancelled: 'cancelled',
};

function mapAppStatus(status) {
  return APP_STATUS[status] || 'upcoming';
}

function durationMinutes(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

// Shapes a Job (populated with clientRef: name billingAddress contactPhone)
// for the technician app. Never exposes internal refs. With `withUrls`,
// photo paths get short-lived signed URLs; a signing failure degrades to
// url:null per photo (the app shows a retryable placeholder), never throws.
async function toAppJob(job, { withUrls = false } = {}) {
  const client = job.clientRef && job.clientRef.name !== undefined ? job.clientRef : null;
  const photoPaths = (job.photos || []).map((p) => p.path);
  let urls = new Map();
  if (withUrls && photoPaths.length > 0) {
    urls = await createSignedUrls(photoPaths);
  }
  return {
    id: String(job._id),
    jobNumber: job.jobNumber,
    status: mapAppStatus(job.status),
    scheduledDate: job.scheduledDate,
    time: job.scheduledTime || '',
    client: client ? client.name : '',
    clientPhone: client ? client.contactPhone || '' : '',
    address: job.site || (client && client.billingAddress) || '',
    jobType: job.jobType,
    task: job.notes || job.jobType,
    priority: job.priority,
    checklist: (job.checklist || []).map((i) => ({ label: i.label, done: i.done })),
    parts: job.parts || [],
    photos: (job.photos || []).map((p) => ({
      path: p.path,
      uploadedAt: p.uploadedAt,
      url: withUrls ? urls.get(p.path) || null : null,
    })),
    hasSignature: Boolean(job.signature && job.signature.svgPaths && job.signature.svgPaths.length > 0),
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    durationMinutes: durationMinutes(job.startedAt, job.completedAt),
  };
}

module.exports = { mapAppStatus, durationMinutes, toAppJob };
