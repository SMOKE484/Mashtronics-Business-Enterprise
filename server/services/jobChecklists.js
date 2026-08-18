'use strict';

// Default on-site checklist templates, copied onto a Job at creation when the
// admin doesn't supply one. Pure module (no DB), same convention as pricing.js.
//
// jobType is free text in the admin UI ("e.g. CCTV install"), so templates are
// keyword-matched, not exact-matched. Item wording generalized from the
// SecureWatch technician mockup seeds (mashtronics (1)/source-export/app-tech.jsx).

const TEMPLATES = {
  install: [
    'Confirm site access with client',
    'Mount cameras and hardware per job spec',
    'Run cabling to NVR',
    'Configure network + app pairing',
    'Test night vision + motion detection',
    'Client walkthrough + handover',
  ],
  service: [
    'Clean all camera lenses',
    'Check cable + mount integrity',
    'Update firmware on NVR',
    'Verify recording storage capacity',
    'Walkthrough with client',
  ],
  repair: [
    'Diagnose power / network fault',
    'Replace faulty components as needed',
    'Re-test connection to app',
    'Confirm footage syncing',
  ],
  generic: [
    'Confirm site access with client',
    'Complete the scheduled work',
    'Test the installed/repaired system',
    'Walkthrough with client',
  ],
};

// Order matters: first keyword group that matches wins.
const KEYWORD_GROUPS = [
  { keywords: ['install'], template: 'install' },
  { keywords: ['service', 'maintenance'], template: 'service' },
  { keywords: ['repair', 'fix', 'fault'], template: 'repair' },
];

function checklistForJobType(jobType) {
  const type = String(jobType || '').toLowerCase();
  let key = 'generic';
  for (const group of KEYWORD_GROUPS) {
    if (group.keywords.some((k) => type.includes(k))) {
      key = group.template;
      break;
    }
  }
  return TEMPLATES[key].map((label) => ({ label, done: false }));
}

module.exports = { checklistForJobType, TEMPLATES };
