'use strict';
const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  clientRef:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  name:           { type: String, required: true, trim: true },
  location:       { type: String, default: '', trim: true },
  model:          { type: String, default: '', trim: true },
  status:         { type: String, enum: ['online', 'offline'], default: 'offline' },
  signal:         { type: String, enum: ['Strong', 'Medium', 'Weak', '—'], default: '—' },
  streamProvider: { type: String, default: null },
  streamConfig:   { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  deviceSerial:   { type: String, default: '', trim: true },
  // Set only for a channel on a multi-channel NVR/DVR (Dahua's online/offline
  // callback events carry channelId for a per-channel event, and omit it for
  // a whole-device event) — null for a standalone IPC or a whole-device row.
  channelId:      { type: Number, default: null },
  firmwareVersion:   { type: String, default: '', trim: true },
  // Admin-toggled only — there's no source of truth for "latest firmware per
  // model" to compare against, so this is deliberately not computed.
  firmwareOutOfDate: { type: Boolean, default: false },
  // Encrypted Dahua device credentials ({ iv, authTag, ciphertext, encryptedAt }
  // from services/deviceCredentials.js). Kept separate from streamConfig so
  // streamConfig stays pure non-secret provider settings.
  credentials:    { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  archived:       { type: Boolean, default: false },
}, { timestamps: true });

// Lookup shape used by the Dahua callback route to map a pushed event's
// deviceId+channelId back to the right Camera document.
cameraSchema.index({ deviceSerial: 1, channelId: 1 });

module.exports = mongoose.model('Camera', cameraSchema);
