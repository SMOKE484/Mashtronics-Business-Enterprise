'use strict';
const mongoose = require('mongoose');

// Checklist items are addressed by array index from the technician app
// (explicit { done } sets, so retries are idempotent) — no per-item _id needed.
const checklistItemSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  done:  { type: Boolean, default: false },
}, { _id: false });

// Proof-of-work photos live in the private Supabase Storage bucket
// `job-photos`; `path` is the object key (`<uid>/jobs/<jobId>/<file>`), never
// a URL — signed URLs are minted on read.
const photoSchema = new mongoose.Schema({
  path:       { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// Customer sign-off signature, stored as downsampled SVG path strings drawn
// on the phone. Kept on the doc (small, ~2-5KB) instead of Storage so it
// renders anywhere without an image pipeline.
const signatureSchema = new mongoose.Schema({
  svgPaths:   { type: [String], default: [] },
  viewWidth:  { type: Number },
  viewHeight: { type: Number },
  capturedAt: { type: Date },
}, { _id: false });

const jobSchema = new mongoose.Schema({
  jobNumber:     { type: String, required: true, unique: true },
  clientRef:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  site:          { type: String, default: '' },
  jobType:       { type: String, required: true, trim: true },
  technicianRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String, default: '' },
  priority:      { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status:        { type: String, enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Scheduled' },
  quoteRef:      { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  notes:         { type: String, default: '' },
  checklist:     { type: [checklistItemSchema], default: [] },
  parts:         { type: [String], default: [] },
  photos:        { type: [photoSchema], default: [] },
  signature:     { type: signatureSchema, default: null },
  startedAt:     { type: Date, default: null },
  completedAt:   { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
