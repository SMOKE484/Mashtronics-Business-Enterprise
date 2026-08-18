// Wizard gating for the job-detail flow — mirrors the server's authoritative
// gates (server/routes/appJobs.js completeHandler) so buttons can disable
// instantly instead of waiting for a 409. Pure — unit tested in
// jobGating.test.js. `job` is the toAppJob shape from the API.

export function checklistProgress(job) {
  const items = (job && job.checklist) || [];
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length };
}

// Checklist step CTA: every task must be ticked (an empty checklist is
// trivially complete — the server treats it the same way).
export function canContinueChecklist(job) {
  const { done, total } = checklistProgress(job);
  return done === total;
}

// Photos step CTA.
export function hasProofPhoto(job) {
  return Boolean(job && job.photos && job.photos.length >= 1);
}

// Sign-off CTA: all server gates plus a drawn signature.
export function canComplete(job, signatureStrokes) {
  if (!job || job.status !== 'in-progress') return false;
  if (!canContinueChecklist(job)) return false;
  if (!hasProofPhoto(job)) return false;
  return Array.isArray(signatureStrokes) && signatureStrokes.length > 0;
}
