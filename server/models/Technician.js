'use strict';
const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  phone:  { type: String, default: '', trim: true },
  email:  { type: String, default: '', trim: true, lowercase: true },
  role:   { type: String, default: '', trim: true },
  // Defaults to inactive — a technician can only be made active once phone,
  // email, and role are all filled in (enforced in routes/technicians.js).
  active: { type: Boolean, default: false },

  // No `default: null` here deliberately — a stored literal null is still
  // indexed by a sparse index (only a truly *missing* field is excluded),
  // so a default would collide every unlinked record on the same null key.
  supabaseUserId:     { type: String, index: true, sparse: true, unique: true },
  appInviteCode:      { type: String, default: null },
  appInviteExpiresAt: { type: Date, default: null },
  // Not unique/indexed, so `default: null` here carries none of the sparse-
  // index collision risk noted above for supabaseUserId.
  expoPushToken:      { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Technician', technicianSchema);
