'use strict';
const mongoose = require('mongoose');

// A device that was shared to our ARC company (a Dahua `bindDevice` push
// event) but hasn't been assigned to a Mashtronics client yet. Surfaced in
// the admin so a human confirms the right client before a Camera record is
// created and the device is activated — bindDevice's ownerEmail/ownerPhone
// are only a *suggested* match, never auto-assigned (wrong attribution would
// hand live view/status of one client's camera to another).
const dahuaPendingBindSchema = new mongoose.Schema({
  deviceSerial:      { type: String, required: true, trim: true },
  ownerEmail:         { type: String, default: '', trim: true, lowercase: true },
  ownerPhone:         { type: String, default: '', trim: true },
  companyId:          { type: String, default: '' },
  status:             { type: String, enum: ['pending', 'resolved', 'ignored'], default: 'pending' },
  suggestedClientRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  resolvedClientRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  resolvedCameraRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Camera', default: null },
  resolvedAt:         { type: Date, default: null },
  raw:                { type: mongoose.Schema.Types.Mixed },
}, { timestamps: { createdAt: 'receivedAt', updatedAt: false } });

// A device can only have one open pending-bind row at a time — a redelivered
// bindDevice event for the same SN while one is already pending should not
// spam duplicate rows into the admin's review queue.
dahuaPendingBindSchema.index({ deviceSerial: 1, status: 1 });

module.exports = mongoose.model('DahuaPendingBind', dahuaPendingBindSchema);
