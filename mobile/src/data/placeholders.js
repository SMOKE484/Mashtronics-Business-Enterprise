// PLACEHOLDER DATA — from the mashtronics/ prototype (SW_SEED + inline
// screen data). Everything in this file is fake and clearly scoped: it fills
// the SW3 areas (activity history, subscription, SOS contacts) that have no
// backend yet. Cameras, chat, panic, and profile are wired to the live API
// and must NOT read from here.

export const PLACEHOLDER_ACTIVITY = [
  { id: 'a1', kind: 'job',       title: 'Camera installation · Backyard',  detail: '2 new IP cams added to backyard zone.',           date: '12 May',      status: 'Completed' },
  { id: 'a2', kind: 'complaint', title: 'Garage camera offline',           detail: 'Issue raised. Technician dispatched within 4h.',  date: '08 May',      status: 'Resolved' },
  { id: 'a3', kind: 'job',       title: 'Annual service · All cameras',    detail: 'Lens cleaning, firmware update, IR check.',       date: '14 Apr',      status: 'Completed' },
  { id: 'a4', kind: 'complaint', title: 'Poor video at night',             detail: 'IR adjustment performed on front gate cam.',      date: '22 Mar',      status: 'Resolved' },
  { id: 'a5', kind: 'job',       title: 'Initial install · 4 cameras',     detail: 'Full property installation + DVR setup.',         date: '11 Jan 2025', status: 'Completed' },
];

export const PLACEHOLDER_CONTACTS = [
  { name: 'Sarah Mokoena', relation: 'Sister', phone: '+27 83 221 7790', channels: ['sms', 'call'] },
  { name: 'James Pillay',  relation: 'Spouse', phone: '+27 84 902 4418', channels: ['sms', 'push'] },
  { name: 'Dr. Patel',     relation: 'Doctor', phone: '+27 11 783 4400', channels: ['call'] },
];

export const PLACEHOLDER_SUBSCRIPTION = {
  plan: 'Premium plan',
  price: 'R 1,250',
  summary: '4 cameras · 24/7 armed response · Unlimited callouts',
  contract: 'Jan 2025 → Jan 2027',
  nextPayment: '03 Jun 2026',
};

export const QUOTE_OPTIONS = [
  { label: 'Add more cameras',      detail: 'Expand coverage to new zones' },
  { label: 'Upgrade existing cams', detail: 'Move to 4K or low-light' },
  { label: 'Add motion sensors',    detail: 'Trigger alerts on movement' },
  { label: 'Smart access control',  detail: 'Gate / door integration' },
];

export const COMPLAINT_TYPES = [
  { label: 'Camera offline',     icon: 'wifiOff' },
  { label: 'Camera damaged',     icon: 'wrench' },
  { label: 'Poor video quality', icon: 'image' },
  { label: 'Other',              icon: 'info' },
];
