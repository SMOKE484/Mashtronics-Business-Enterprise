'use strict';
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  sector:         { type: String, default: '', trim: true },
  status:         { type: String, enum: ['active', 'prospect', 'inactive'], default: 'active' },
  clientSince:    { type: Date, default: Date.now },
  scopeOfWork:    { type: String, default: '' },
  billingAddress: { type: String, default: '' },
  contactName:    { type: String, default: '', trim: true },
  contactPhone:   { type: String, default: '', trim: true },
  contactEmail:   { type: String, default: '', trim: true, lowercase: true },
  notes:          { type: String, default: '' },
  archived:       { type: Boolean, default: false },
  chatMode:       { type: String, enum: ['ai', 'human'], default: 'ai' },
  chatTopic:      { type: String, enum: ['', 'camera', 'billing', 'general', 'other'], default: '' },

  // No `default: null` here deliberately — a stored literal null is still
  // indexed by a sparse index (only a truly *missing* field is excluded),
  // so a default would collide every unlinked record on the same null key.
  supabaseUserId:     { type: String, index: true, sparse: true, unique: true },
  appInviteCode:      { type: String, default: null },
  appInviteExpiresAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
