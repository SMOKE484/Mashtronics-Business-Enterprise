'use strict';
const mongoose = require('mongoose');

// One row per pushed Dahua Open ARC event (server/routes/dahuaCallback.js).
// The unique index on dahuaMessageId is what makes callback processing
// idempotent — Dahua re-pushes an event until it's Acked, and a duplicate
// insert here is treated as "already processed" rather than an error.
const dahuaEventLogSchema = new mongoose.Schema({
  dahuaMessageId: { type: String, required: true, unique: true },
  msgType:        { type: String, required: true },
  deviceId:       { type: String, default: '' },
  channelId:      { type: Number, default: null },
  companyId:      { type: String, default: '' },
  raw:            { type: mongoose.Schema.Types.Mixed },
}, { timestamps: { createdAt: 'receivedAt', updatedAt: false } });

module.exports = mongoose.model('DahuaEventLog', dahuaEventLogSchema);
