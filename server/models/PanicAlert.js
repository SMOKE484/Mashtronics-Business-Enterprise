'use strict';
const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  label:         { type: String, required: true, trim: true },
  detail:        { type: String, default: '', trim: true },
  technicianRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
  at:            { type: Date, default: Date.now },
}, { _id: false });

const panicAlertSchema = new mongoose.Schema({
  clientRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  status:      { type: String, enum: ['active', 'resolved', 'cancelled'], default: 'active' },
  stages:      { type: [stageSchema], default: [] },
  triggeredAt: { type: Date, default: Date.now },
  resolvedAt:  { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('PanicAlert', panicAlertSchema);
